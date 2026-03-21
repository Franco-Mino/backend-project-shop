export interface CreateRefreshTokenProps {
  id: string; // jti — identificador único del token en BD
  userId: string;
  expiresAt: Date;
}

/**
 * DOMAIN ENTITY — RefreshToken
 *
 * Representa un refresh token activo en la base de datos.
 * El token raw (firmado JWT) nunca se almacena — solo el jti.
 * La revocación se realiza marcando revokedAt.
 */
export class RefreshToken {
  id: string; // jti
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;

  static create(props: CreateRefreshTokenProps): RefreshToken {
    const token = new RefreshToken();
    token.id = props.id;
    token.userId = props.userId;
    token.expiresAt = props.expiresAt;
    token.revokedAt = null;
    return token;
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }
}
