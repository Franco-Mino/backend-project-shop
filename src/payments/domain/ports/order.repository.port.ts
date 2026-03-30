import { Order } from '../entities/order.entity';

/**
 * PORT — IOrderRepository
 *
 * Contrato de persistencia para órdenes. La capa de aplicación solo
 * conoce esta interfaz; la infraestructura provee la implementación concreta.
 */

export const ORDER_REPOSITORY_PORT = 'ORDER_REPOSITORY_PORT';

export interface IOrderRepository {
  /** Persiste una orden nueva */
  create(order: Order): Promise<Order>;

  /** Actualiza el status de una orden */
  updateStatus(id: string, status: Order['status']): Promise<Order>;

  /** Busca por ID. Retorna null si no existe */
  findById(id: string): Promise<Order | null>;

  /** Busca por el ID del PaymentIntent de Stripe */
  findByPaymentIntentId(paymentIntentId: string): Promise<Order | null>;
}
