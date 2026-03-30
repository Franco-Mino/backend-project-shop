import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';

import { CreateOrderCommand } from './create-order.command';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.vo';
import { OrderStatus } from '../../../domain/enums/order-status.enum';
import {
  ORDER_REPOSITORY_PORT,
  type IOrderRepository,
} from '../../../domain/ports/order.repository.port';
import {
  PAYMENT_SERVICE_PORT,
  type IPaymentService,
} from '../../../domain/ports/payment.service.port';
import {
  PRODUCT_REPOSITORY_PORT,
  type IProductRepository,
} from '../../../../products/domain/ports/product.repository.port';

export interface CreateOrderResult {
  order: Order;
  clientSecret: string;
}

/**
 * COMMAND HANDLER — CreateOrderHandler
 *
 * Orquesta el caso de uso "iniciar compra":
 *
 *   1. Valida que todos los productos existen y están activos
 *   2. Decrements el stock de forma atómica con pessimistic locking
 *      → Si dos usuarios compran el mismo ítem simultáneamente, la DB
 *        serializa las transacciones. El primero en obtener el lock
 *        decrementa; el segundo lee stock = 0 y recibe ConflictException.
 *   3. Crea la entidad Order con status PENDING
 *   4. Crea un PaymentIntent en Stripe → obtiene clientSecret
 *   5. Persiste la orden con el stripePaymentIntentId
 *   6. Retorna { order, clientSecret } al controller
 *
 * Si Stripe falla DESPUÉS de haber decrementado stock, restauramos el
 * stock para no bloquear inventario indefinidamente.
 */
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<
  CreateOrderCommand,
  CreateOrderResult
> {
  private readonly logger = new Logger(CreateOrderHandler.name);
  private readonly currency = 'usd';

  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: IOrderRepository,
    @Inject(PAYMENT_SERVICE_PORT)
    private readonly paymentService: IPaymentService,
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(command: CreateOrderCommand): Promise<CreateOrderResult> {
    const { userId, items } = command;

    // 1. Validar que todos los productos existen
    const products = await Promise.all(
      items.map(async (item) => {
        const product = await this.productRepository.findById(item.productId);
        if (!product) {
          throw new NotFoundException(
            `Product with id "${item.productId}" not found`,
          );
        }
        return product;
      }),
    );

    // 2. Construir OrderItems capturando el precio actual
    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return OrderItem.create({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
      });
    });

    const totalAmount = parseFloat(
      orderItems.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2),
    );

    // 3. Decrement stock atómico (SELECT FOR UPDATE en batch)
    //    Si hay stock insuficiente para cualquier ítem, lanza ConflictException
    //    y NO se crea la orden ni se llama a Stripe.
    await this.productRepository.decrementStockBatch(
      items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    );

    this.logger.log(`Stock decremented for order by user ${userId}`);

    // 4. Crear entidad de dominio (sin stripePaymentIntentId todavía)
    const orderId = randomUUID();
    const order = Order.create({
      id: orderId,
      userId,
      items: orderItems,
      totalAmount,
      status: OrderStatus.PENDING,
      stripePaymentIntentId: '',
      createdAt: new Date(),
    });

    // 5. Crear PaymentIntent en Stripe
    //    Si Stripe falla, restauramos el stock para no bloquear inventario
    let clientSecret: string;
    try {
      const paymentIntent = await this.paymentService.createPaymentIntent(
        totalAmount,
        this.currency,
        { orderId },
      );

      // 6. Persistir la orden
      const saved = await this.orderRepository.create(
        Order.create({
          id: order.id,
          userId: order.userId,
          items: order.items,
          totalAmount: order.totalAmount,
          status: order.status,
          stripePaymentIntentId: paymentIntent.id,
          createdAt: order.createdAt,
        }),
      );

      this.logger.log(
        `Order ${saved.id} created with Stripe PI ${paymentIntent.id}`,
      );
      clientSecret = paymentIntent.clientSecret;
      return { order: saved, clientSecret };
    } catch (error) {
      // Rollback de stock si Stripe o la DB fallaron
      this.logger.warn(
        `Restoring stock after failed order creation for user ${userId}`,
      );
      await this.productRepository.restoreStockBatch(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      );
      throw error;
    }
  }
}
