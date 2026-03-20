import { RefreshToken } from '../entities/refresh-token.entity';

export const REFRESH_TOKEN_REPOSITORY_PORT = 'REFRESH_TOKEN_REPOSITORY_PORT';

export interface IRefreshTokenRepository {
  /** Persiste un nuevo refresh token (jti). */
  create(token: RefreshToken): Promise<void>;

  /** Busca por jti (el ID embebido en el JWT). */
  findByJti(jti: string): Promise<RefreshToken | null>;

  /** Marca el token como revocado (logout / rotación). */
  revoke(jti: string): Promise<void>;

  /** Revoca todos los tokens activos del usuario (logout global). */
  revokeAllByUserId(userId: string): Promise<void>;
}
