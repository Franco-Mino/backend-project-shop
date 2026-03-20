import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  IUserRepository,
  PaginationOptions,
} from '../../../domain/ports/user.repository.port';
import { User } from '../../../domain/entities/user.entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { UserPersistenceMapper } from '../mappers/user.persistence-mapper';

/**
 * ADAPTER — TypeOrmUserRepository
 *
 * Implementación concreta del port IUserRepository usando TypeORM.
 * El resto de la app solo conoce el contrato, nunca esta clase directamente.
 *
 * Nota: password tiene select:false en la ORM entity para no exponerla
 * en queries genéricas. Para login necesitamos addSelect explícito.
 */
@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async create(user: User): Promise<User> {
    const orm = UserPersistenceMapper.toOrm(user);
    const saved = await this.repo.save(orm);
    const reloaded = await this.repo.findOneOrFail({ where: { id: saved.id } });
    return UserPersistenceMapper.toDomain(reloaded);
  }

  async findByEmail(email: string): Promise<User | null> {
    // addSelect: password porque select:false lo omite por defecto
    const orm = await this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: email.toLowerCase().trim() })
      .getOne();

    return orm ? UserPersistenceMapper.toDomain(orm) : null;
  }

  async findById(id: string): Promise<User | null> {
    const orm = await this.repo.findOne({ where: { id, isActive: true } });
    return orm ? UserPersistenceMapper.toDomain(orm) : null;
  }

  async findAll(options: PaginationOptions): Promise<User[]> {
    const orms = await this.repo.find({
      take: options.limit,
      skip: options.offset,
      order: { email: 'ASC' },
    });
    return orms.map((orm) => UserPersistenceMapper.toDomain(orm));
  }

  async update(
    id: string,
    changes: Partial<Pick<User, 'email' | 'fullName' | 'password' | 'roles' | 'isActive'>>,
  ): Promise<User> {
    const updateData: Partial<UserOrmEntity> = {};
    if (changes.email !== undefined) updateData.email = changes.email;
    if (changes.fullName !== undefined) updateData.fullName = changes.fullName;
    if (changes.password !== undefined) updateData.password = changes.password;
    if (changes.roles !== undefined) updateData.roles = changes.roles;
    if (changes.isActive !== undefined) updateData.isActive = changes.isActive;

    await this.repo.update(id, updateData);
    const updated = await this.repo.findOneOrFail({ where: { id } });
    return UserPersistenceMapper.toDomain(updated);
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    await this.repo.increment({ id }, 'failedLoginAttempts', 1);
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await this.repo.update(id, { failedLoginAttempts: 0 });
  }
}
