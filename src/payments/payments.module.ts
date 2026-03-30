import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';

// Domain
import { ORDER_REPOSITORY_PORT } from './domain/ports/order.repository.port';
import { PAYMENT_SERVICE_PORT } from './domain/ports/payment.service.port';

// Application — Commands
import { CreateOrderHandler } from './application/commands/create-order/create-order.handler';
import { CancelOrderHandler } from './application/commands/cancel-order/cancel-order.handler';
import { HandleStripeWebhookHandler } from './application/commands/handle-stripe-webhook/handle-stripe-webhook.handler';

// Application — Queries
import { GetOrderHandler } from './application/queries/get-order/get-order.handler';
import { ListUserOrdersHandler } from './application/queries/list-user-orders/list-user-orders.handler';
import { ListAllOrdersHandler } from './application/queries/list-all-orders/list-all-orders.handler';

// Infrastructure — Persistence
import { OrderOrmEntity } from './infrastructure/persistence/entities/order.orm-entity';
import { TypeOrmOrderRepository } from './infrastructure/persistence/repositories/typeorm-order.repository';

// Infrastructure — Stripe
import { StripePaymentAdapter } from './infrastructure/stripe/stripe-payment.adapter';

// Infrastructure — HTTP
import { PaymentsController } from './infrastructure/http/controllers/payments.controller';

/**
 * PaymentsModule — Bounded Context de Pagos
 *
 * Importa ProductsModule para tener acceso al PRODUCT_REPOSITORY_PORT,
 * que necesitamos para decrementar/restaurar stock.
 *
 * Importa AuthModule para usar JwtAuthGuard y RolesGuard en los endpoints.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([OrderOrmEntity]),
    AuthModule,
    ProductsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    // Port → Adapter bindings
    {
      provide: ORDER_REPOSITORY_PORT,
      useClass: TypeOrmOrderRepository,
    },
    {
      provide: PAYMENT_SERVICE_PORT,
      useClass: StripePaymentAdapter,
    },

    // CQRS Command Handlers
    CreateOrderHandler,
    CancelOrderHandler,
    HandleStripeWebhookHandler,

    // CQRS Query Handlers
    GetOrderHandler,
    ListUserOrdersHandler,
    ListAllOrdersHandler,
  ],
})
export class PaymentsModule {}
