import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  RawBody,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CreateOrderCommand } from '../../../application/commands/create-order/create-order.command';
import { CancelOrderCommand } from '../../../application/commands/cancel-order/cancel-order.command';
import { HandleStripeWebhookCommand } from '../../../application/commands/handle-stripe-webhook/handle-stripe-webhook.command';
import { GetOrderQuery } from '../../../application/queries/get-order/get-order.query';
import { ListUserOrdersQuery } from '../../../application/queries/list-user-orders/list-user-orders.query';
import { ListAllOrdersQuery } from '../../../application/queries/list-all-orders/list-all-orders.query';
import { CreateOrderResult } from '../../../application/commands/create-order/create-order.handler';
import { ListAllOrdersResult } from '../../../application/queries/list-all-orders/list-all-orders.handler';
import { Order } from '../../../domain/entities/order.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { JwtAuthGuard } from '../../../../auth/infrastructure/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/http/guards/roles.guard';
import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import { Role } from '../../../../auth/domain/enums/role.enum';
import { GetUser } from '../../../../auth/infrastructure/http/decorators/get-user.decorator';
import { UserOrmEntity } from '../../../../auth/infrastructure/persistence/entities/user.orm-entity';
import { PaginationDto } from '../../../../common/pagination/dto/pagination.dto';

/**
 * CONTROLLER — PaymentsController
 *
 * Endpoints:
 *   POST  /api/payments/checkout            → Inicia compra (JWT requerido)
 *   GET   /api/payments/orders              → Historial del usuario (JWT)
 *   GET   /api/payments/orders/:id          → Detalle de orden propia (JWT)
 *   PATCH /api/payments/orders/:id/cancel   → Cancelar orden PENDING (JWT)
 *   GET   /api/payments/admin/orders        → Todas las órdenes (ADMIN+)
 *   POST  /api/payments/webhook             → Webhook de Stripe (sin JWT)
 */
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ─── Usuario autenticado ──────────────────────────────────────────────────

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @Body() dto: CreateOrderDto,
    @GetUser() user: UserOrmEntity,
  ): Promise<{ orderId: string; clientSecret: string }> {
    const result: CreateOrderResult = await this.commandBus.execute(
      new CreateOrderCommand({
        userId: user.id,
        items: dto.items,
      }),
    );

    return {
      orderId: result.order.id,
      clientSecret: result.clientSecret,
    };
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async listMyOrders(
    @GetUser() user: UserOrmEntity,
    @Query() pagination: PaginationDto,
  ): Promise<Order[]> {
    return this.queryBus.execute<Order[]>(
      new ListUserOrdersQuery(user.id, pagination.limit, pagination.offset),
    );
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  async getOrder(
    @Param('id', ParseUUIDPipe) orderId: string,
    @GetUser() user: UserOrmEntity,
  ): Promise<Order> {
    return this.queryBus.execute<Order>(
      new GetOrderQuery({ orderId, userId: user.id }),
    );
  }

  @Patch('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelOrder(
    @Param('id', ParseUUIDPipe) orderId: string,
    @GetUser() user: UserOrmEntity,
  ): Promise<Order> {
    return this.commandBus.execute<Order>(
      new CancelOrderCommand(orderId, user.id),
    );
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async listAllOrders(
    @Query() pagination: PaginationDto,
  ): Promise<ListAllOrdersResult> {
    return this.queryBus.execute<ListAllOrdersResult>(
      new ListAllOrdersQuery(pagination.limit, pagination.offset),
    );
  }

  // ─── Webhook Stripe (sin JWT — verifica firma HMAC) ──────────────────────

  /**
   * Retorna siempre 200 para que Stripe no reintente.
   * Solo retorna 400 si la firma es inválida.
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    await this.commandBus.execute(
      new HandleStripeWebhookCommand({ rawBody, signature }),
    );
    return { received: true };
  }
}
