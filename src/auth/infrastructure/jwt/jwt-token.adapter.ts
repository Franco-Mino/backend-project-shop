import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import {
  ITokenService,
  JwtPayload,
  RefreshTokenPayload,
  GeneratedRefreshToken,
} from '../../domain/ports/token.service.port';
import { User } from '../../domain/entities/user.entity';

/**
 * ADAPTER — JwtTokenAdapter
 *
 * Genera y verifica access tokens y refresh tokens JWT.
 *
 * Access token:  payload estándar { sub, email, roles }, TTL desde config
 * Refresh token: payload mínimo  { sub, jti, type:'refresh' }, TTL 7d
 *   El jti se persiste en BD para permitir revocación granular.
 *   El JWT firmado nunca se almacena — solo el jti.
 */
@Injectable()
export class JwtTokenAdapter implements ITokenService {
  private readonly refreshTokenTtlMs: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const days = Number(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_DAYS', '7'),
    );
    this.refreshTokenTtlMs = days * 24 * 60 * 60 * 1000;
  }

  generateToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };
    return this.jwtService.sign(payload);
  }

  generateRefreshToken(user: User): GeneratedRefreshToken {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlMs);

    const payload: RefreshTokenPayload = {
      sub: user.id,
      jti,
      type: 'refresh',
    };

    const raw = this.jwtService.sign(payload, {
      expiresIn: `${this.refreshTokenTtlMs / 1000}s`,
    });

    return { raw, jti, expiresAt };
  }

  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(token);
      if (payload.type !== 'refresh') return null;
      return payload;
    } catch {
      return null;
    }
  }
}
