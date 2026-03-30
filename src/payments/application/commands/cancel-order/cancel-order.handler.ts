import {
  ConflictException,
  ForbiddenException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { CancelOrderCommand } from './cancel-order.command';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatus } from '../../../domain/enums/order-status.enum';
import {
  ORDER_REPOSITORY_PORT,
  type IOrderRepository,
} from '../../../domain/ports/order.repository.port';
import {
  PRODUCT_REPOSITORY_PORT,
  type IProductRepository,
} from '../../../../products/domain/ports/product.repository.port';

/**
 * COMMAND HANDLER — CancelOrderHandler
 *
 * Reglas de negocio:
 *   1. Solo el dueño de la orden puede cancelarla → 403 si es de otro
 *   2. Solo se puede cancelar si está PENDING → 409 si ya fue pagada/fallida
 *   3. Al cancelar se restaura el stock reservado
 */
@CommandHandler(CancelOrderCommand)
export class CancelOrderHandler implements ICommandHandler<
  CancelOrderCommand,
  Order
> {
  private readonly logger = new Logger(CancelOrderHandler.name);

  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: IOrderRepository,
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(command: CancelOrderCommand): Promise<Order> {
    const { orderId, userId } = command;

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException(
        `Cannot cancel an order with status "${order.status}". Only PENDING orders can be cancelled.`,
      );
    }

    // Restaurar stock antes de marcar como cancelada
    await this.productRepository.restoreStockBatch(
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    );

    const cancelled = await this.orderRepository.updateStatus(
      orderId,
      OrderStatus.CANCELLED,
    );

    this.logger.log(
      `Order ${orderId} cancelled by user ${userId} — stock restored`,
    );

    return cancelled;
  }
}
