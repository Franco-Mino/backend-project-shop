import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { IRefreshTokenRepository } from '../../../domain/ports/refresh-token.repository.port';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity';
import { RefreshTokenOrmEntity } from '../entities/refresh-token.orm-entity';

/**
 * ADAPTER — TypeOrmRefreshTokenRepository
 */
@Injectable()
export class TypeOrmRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly repo: Repository<RefreshTokenOrmEntity>,
  ) {}

  async create(token: RefreshToken): Promise<void> {
    const orm = new RefreshTokenOrmEntity();
    orm.id = token.id;
    orm.userId = token.userId;
    orm.expiresAt = token.expiresAt;
    orm.revokedAt = token.revokedAt;
    await this.repo.save(orm);
  }

  async findByJti(jti: string): Promise<RefreshToken | null> {
    const orm = await this.repo.findOne({ where: { id: jti } });
    if (!orm) return null;

    const token = new RefreshToken();
    token.id = orm.id;
    token.userId = orm.userId;
    token.expiresAt = orm.expiresAt;
    token.revokedAt = orm.revokedAt;
    return token;
  }

  async revoke(jti: string): Promise<void> {
    await this.repo.update(jti, { revokedAt: new Date() });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.repo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
