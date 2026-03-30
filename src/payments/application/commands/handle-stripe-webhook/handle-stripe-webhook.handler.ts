import {
  BadRequestException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { HandleStripeWebhookCommand } from './handle-stripe-webhook.command';
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

/**
 * COMMAND HANDLER — HandleStripeWebhookHandler
 *
 * Procesa eventos de Stripe enviados vía webhook:
 *
 *   payment_intent.succeeded  → Marca la orden como PAID
 *   payment_intent.payment_failed → Marca la orden como FAILED + restaura stock
 *
 * La verificación de firma (`constructWebhookEvent`) garantiza que el
 * evento proviene realmente de Stripe y no de un atacante externo.
 *
 * Siempre retorna 200 a Stripe (incluso en errores de negocio) para
 * que Stripe no reintente indefinidamente. Solo propagamos errores de
 * firma inválida (400) para rechazar eventos falsificados.
 */
@CommandHandler(HandleStripeWebhookCommand)
export class HandleStripeWebhookHandler implements ICommandHandler<
  HandleStripeWebhookCommand,
  void
> {
  private readonly logger = new Logger(HandleStripeWebhookHandler.name);

  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: IOrderRepository,
    @Inject(PAYMENT_SERVICE_PORT)
    private readonly paymentService: IPaymentService,
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(command: HandleStripeWebhookCommand): Promise<void> {
    const { rawBody, signature } = command;

    // Verificar firma — lanza BadRequestException si es inválida
    let event: ReturnType<IPaymentService['constructWebhookEvent']>;
    try {
      event = this.paymentService.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const { type, paymentIntentId } = event;

    this.logger.log(
      `Stripe webhook received: ${type} for PI ${paymentIntentId}`,
    );

    if (
      type !== 'payment_intent.succeeded' &&
      type !== 'payment_intent.payment_failed'
    ) {
      // Evento que no nos interesa — retornamos sin error para que Stripe no reintente
      return;
    }

    const order =
      await this.orderRepository.findByPaymentIntentId(paymentIntentId);
    if (!order) {
      // Puede ocurrir en race conditions o en pruebas de Stripe Dashboard
      this.logger.warn(`Order not found for PaymentIntent ${paymentIntentId}`);
      throw new NotFoundException(
        `Order for payment intent ${paymentIntentId} not found`,
      );
    }

    if (type === 'payment_intent.succeeded') {
      await this.orderRepository.updateStatus(order.id, OrderStatus.PAID);
      this.logger.log(`Order ${order.id} marked as PAID`);
    }

    if (type === 'payment_intent.payment_failed') {
      await this.orderRepository.updateStatus(order.id, OrderStatus.FAILED);
      this.logger.log(`Order ${order.id} marked as FAILED — restoring stock`);

      // Restaurar stock para que el producto vuelva a estar disponible
      await this.productRepository.restoreStockBatch(
        order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
    }
  }
}
