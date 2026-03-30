import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListUserOrdersQuery } from './list-user-orders.query';
import { Order } from '../../../domain/entities/order.entity';
import {
  ORDER_REPOSITORY_PORT,
  type IOrderRepository,
} from '../../../domain/ports/order.repository.port';

/**
 * QUERY HANDLER — ListUserOrdersHandler
 *
 * Retorna el historial de órdenes del usuario autenticado,
 * ordenado de más reciente a más antiguo.
 */
@QueryHandler(ListUserOrdersQuery)
export class ListUserOrdersHandler implements IQueryHandler<
  ListUserOrdersQuery,
  Order[]
> {
  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: IOrderRepository,
  ) {}

  async execute(query: ListUserOrdersQuery): Promise<Order[]> {
    return this.orderRepository.findByUserId(query.userId, {
      limit: query.limit,
      offset: query.offset,
    });
  }
}
