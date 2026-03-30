import { OrderItem } from './order-item.vo';
import { OrderStatus } from '../enums/order-status.enum';

/**
 * AGGREGATE ROOT — Order
 *
 * Representa una orden de compra. Es el aggregate root del contexto
 * de pagos: toda operación sobre ítems pasa por esta entidad.
 *
 * Diseño inmutable: los métodos de transición de estado devuelven
 * una nueva instancia en lugar de mutar la existente. Esto facilita
 * el testing y evita efectos secundarios inesperados.
 */

export interface OrderProps {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  stripePaymentIntentId: string;
  createdAt: Date;
}

export class Order {
  readonly id: string;
  readonly userId: string;
  readonly items: OrderItem[];
  readonly totalAmount: number;
  readonly status: OrderStatus;
  readonly stripePaymentIntentId: string;
  readonly createdAt: Date;

  private constructor(props: OrderProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.items = props.items;
    this.totalAmount = props.totalAmount;
    this.status = props.status;
    this.stripePaymentIntentId = props.stripePaymentIntentId;
    this.createdAt = props.createdAt;
  }

  static create(props: OrderProps): Order {
    return new Order(props);
  }

  /** Transición: PENDING → PAID (llamado desde el webhook de Stripe) */
  markAsPaid(): Order {
    return Order.create({ ...this.toProps(), status: OrderStatus.PAID });
  }

  /** Transición: PENDING → FAILED (llamado cuando Stripe falla o expira) */
  markAsFailed(): Order {
    return Order.create({ ...this.toProps(), status: OrderStatus.FAILED });
  }

  private toProps(): OrderProps {
    return {
      id: this.id,
      userId: this.userId,
      items: this.items,
      totalAmount: this.totalAmount,
      status: this.status,
      stripePaymentIntentId: this.stripePaymentIntentId,
      createdAt: this.createdAt,
    };
  }
}
