import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';

import { IPasswordResetTokenRepository } from '../../../domain/ports/password-reset-token.repository.port';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token.entity';
import { PasswordResetTokenOrmEntity } from '../entities/password-reset-token.orm-entity';

/**
 * ADAPTER — TypeOrmPasswordResetTokenRepository
 *
 * Implementación del port IPasswordResetTokenRepository usando TypeORM.
 */
@Injectable()
export class TypeOrmPasswordResetTokenRepository
  implements IPasswordResetTokenRepository
{
  constructor(
    @InjectRepository(PasswordResetTokenOrmEntity)
    private readonly repo: Repository<PasswordResetTokenOrmEntity>,
  ) {}

  async create(token: PasswordResetToken): Promise<PasswordResetToken> {
    const orm = this.repo.create({
      id: token.id,
      userId: token.userId,
      hashedCode: token.hashedCode,
      expiresAt: token.expiresAt,
      usedAt: null,
    });
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async findActiveByUserId(
    userId: string,
  ): Promise<PasswordResetToken | null> {
    const now = new Date();
    const orm = await this.repo.findOne({
      where: {
        userId,
        usedAt: IsNull(),
        expiresAt: LessThan(now) as any,
      },
    });

    // Búsqueda manual para expiresAt > now (TypeORM MoreThan se usa así)
    const active = await this.repo
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .andWhere('t.usedAt IS NULL')
      .andWhere('t.expiresAt > :now', { now })
      .getOne();

    return active ? this.toDomain(active) : null;
  }

  async markAsUsed(id: string): Promise<void> {
    await this.repo.update(id, { usedAt: new Date() });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  private toDomain(orm: PasswordResetTokenOrmEntity): PasswordResetToken {
    const token = new PasswordResetToken();
    token.id = orm.id;
    token.userId = orm.userId;
    token.hashedCode = orm.hashedCode;
    token.expiresAt = orm.expiresAt;
    token.usedAt = orm.usedAt;
    return token;
  }
}
