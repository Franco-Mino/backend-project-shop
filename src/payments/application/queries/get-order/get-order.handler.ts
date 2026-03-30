import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetOrderQuery } from './get-order.query';
import { Order } from '../../../domain/entities/order.entity';
import {
  ORDER_REPOSITORY_PORT,
  type IOrderRepository,
} from '../../../domain/ports/order.repository.port';

@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: IOrderRepository,
  ) {}

  async execute(query: GetOrderQuery): Promise<Order> {
    const order = await this.orderRepository.findById(query.orderId);

    if (!order) {
      throw new NotFoundException(`Order "${query.orderId}" not found`);
    }

    // Un usuario solo puede ver sus propias órdenes
    if (order.userId !== query.userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }
}
