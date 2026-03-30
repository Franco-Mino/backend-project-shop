import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IOrderRepository } from '../../../domain/ports/order.repository.port';
import { Order } from '../../../domain/entities/order.entity';
import { OrderOrmEntity } from '../entities/order.orm-entity';
import { OrderPersistenceMapper } from '../mappers/order.persistence.mapper';

@Injectable()
export class TypeOrmOrderRepository implements IOrderRepository {
  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly repo: Repository<OrderOrmEntity>,
  ) {}

  async create(order: Order): Promise<Order> {
    const orm = OrderPersistenceMapper.toOrm(order);
    const saved = await this.repo.save(orm);
    return OrderPersistenceMapper.toDomain(saved);
  }

  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    await this.repo.update(id, { status });
    const updated = await this.repo.findOneByOrFail({ id });
    return OrderPersistenceMapper.toDomain(updated);
  }

  async findById(id: string): Promise<Order | null> {
    const orm = await this.repo.findOneBy({ id });
    return orm ? OrderPersistenceMapper.toDomain(orm) : null;
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<Order | null> {
    const orm = await this.repo.findOneBy({
      stripePaymentIntentId: paymentIntentId,
    });
    return orm ? OrderPersistenceMapper.toDomain(orm) : null;
  }
}
