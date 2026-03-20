import { User } from '../entities/user.entity';
import { Role } from '../enums/role.enum';

/**
 * PORT (interfaz de salida) — ITokenService
 *
 * El handler de login no importa @nestjs/jwt directamente.
 * Si mañana cambian de JWT a Paseto o Auth0, solo cambia el adaptador.
 */
export const TOKEN_SERVICE_PORT = 'TOKEN_SERVICE_PORT';

export interface JwtPayload {
  sub: string;    // user id
  email: string;
  roles: Role[];
}

export interface RefreshTokenPayload {
  sub: string;    // user id
  jti: string;    // ID del registro en BD — permite revocación
  type: 'refresh';
}

export interface GeneratedRefreshToken {
  raw: string;    // JWT firmado — se entrega al cliente
  jti: string;    // UUID — se guarda en BD
  expiresAt: Date;
}

export interface ITokenService {
  generateToken(user: User): string;
  generateRefreshToken(user: User): GeneratedRefreshToken;
  verifyRefreshToken(token: string): RefreshTokenPayload | null;
}
