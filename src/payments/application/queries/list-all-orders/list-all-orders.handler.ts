import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListAllOrdersQuery } from './list-all-orders.query';
import { Order } from '../../../domain/entities/order.entity';
import {
  ORDER_REPOSITORY_PORT,
  type IOrderRepository,
} from '../../../domain/ports/order.repository.port';

export interface ListAllOrdersResult {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * QUERY HANDLER — ListAllOrdersHandler
 *
 * Retorna todas las órdenes del sistema con paginación.
 * Solo accesible por ADMIN y OWNER.
 */
@QueryHandler(ListAllOrdersQuery)
export class ListAllOrdersHandler implements IQueryHandler<
  ListAllOrdersQuery,
  ListAllOrdersResult
> {
  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: IOrderRepository,
  ) {}

  async execute(query: ListAllOrdersQuery): Promise<ListAllOrdersResult> {
    const { orders, total } = await this.orderRepository.findAll({
      limit: query.limit,
      offset: query.offset,
    });
    return { orders, total, limit: query.limit, offset: query.offset };
  }
}
