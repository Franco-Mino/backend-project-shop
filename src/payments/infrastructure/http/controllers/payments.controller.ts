import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBody,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CreateOrderCommand } from '../../../application/commands/create-order/create-order.command';
import { HandleStripeWebhookCommand } from '../../../application/commands/handle-stripe-webhook/handle-stripe-webhook.command';
import { GetOrderQuery } from '../../../application/queries/get-order/get-order.query';
import { CreateOrderResult } from '../../../application/commands/create-order/create-order.handler';
import { Order } from '../../../domain/entities/order.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { JwtAuthGuard } from '../../../../auth/infrastructure/http/guards/jwt-auth.guard';
import { GetUser } from '../../../../auth/infrastructure/http/decorators/get-user.decorator';
import { UserOrmEntity } from '../../../../auth/infrastructure/persistence/entities/user.orm-entity';

/**
 * CONTROLLER — PaymentsController
 *
 * Endpoints:
 *   POST /api/payments/checkout   → Inicia compra (JWT requerido)
 *   GET  /api/payments/orders/:id → Consulta orden propia (JWT requerido)
 *   POST /api/payments/webhook    → Webhook de Stripe (sin JWT, verifica firma)
 *
 * Nota sobre el webhook:
 *   Stripe envía el body como application/json pero necesitamos el raw Buffer
 *   para verificar la firma HMAC. Por eso en main.ts habilitamos rawBody: true
 *   y usamos @RawBody() en este endpoint.
 */
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

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

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  async getOrder(
    @Param('id') orderId: string,
    @GetUser() user: UserOrmEntity,
  ): Promise<Order> {
    return this.queryBus.execute<Order>(
      new GetOrderQuery({ orderId, userId: user.id }),
    );
  }

  /**
   * Webhook de Stripe.
   *
   * IMPORTANTE: Este endpoint NO debe tener el ValidationPipe global aplicado
   * al body, y necesita el raw Buffer. Por eso usamos @RawBody().
   *
   * Retorna siempre 200 para que Stripe no reintente (los errores de negocio
   * ya se logean internamente). Solo retorna 400 si la firma es inválida.
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
