import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

import { OrderStatus } from '../../../domain/enums/order-status.enum';
import { OrderItemProps } from '../../../domain/entities/order-item.vo';

/**
 * ORM ENTITY — OrderOrmEntity
 *
 * Almacenamos los ítems como JSONB en lugar de una tabla separada.
 * Ventaja: una sola consulta para leer la orden completa.
 * Es apropiado porque los ítems son inmutables (snapshot del momento de compra).
 */
@Entity('orders')
export class OrderOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @Column('jsonb')
  items: OrderItemProps[];

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ unique: true })
  @Index()
  stripePaymentIntentId: string;

  @CreateDateColumn()
  createdAt: Date;
}
