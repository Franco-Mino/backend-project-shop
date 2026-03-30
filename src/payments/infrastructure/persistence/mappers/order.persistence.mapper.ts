import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.vo';
import { OrderOrmEntity } from '../entities/order.orm-entity';

/**
 * MAPPER — OrderPersistenceMapper
 *
 * Convierte entre la entidad de dominio (Order) y la entidad ORM (OrderOrmEntity).
 * Esto garantiza que el dominio nunca tenga anotaciones de TypeORM.
 */
export class OrderPersistenceMapper {
  static toOrm(order: Order): OrderOrmEntity {
    const orm = new OrderOrmEntity();
    orm.id = order.id;
    orm.userId = order.userId;
    orm.items = order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));
    orm.totalAmount = order.totalAmount;
    orm.status = order.status;
    orm.stripePaymentIntentId = order.stripePaymentIntentId;
    orm.createdAt = order.createdAt;
    return orm;
  }

  static toDomain(orm: OrderOrmEntity): Order {
    return Order.create({
      id: orm.id,
      userId: orm.userId,
      items: orm.items.map((item) =>
        OrderItem.create({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        }),
      ),
      totalAmount: Number(orm.totalAmount),
      status: orm.status,
      stripePaymentIntentId: orm.stripePaymentIntentId,
      createdAt: orm.createdAt,
    });
  }
}
