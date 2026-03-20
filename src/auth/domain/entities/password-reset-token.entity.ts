export interface CreatePasswordResetTokenProps {
  id: string;
  userId: string;
  hashedCode: string;
  expiresAt: Date;
}

/**
 * DOMAIN ENTITY — PasswordResetToken
 *
 * Representa un código de recuperación de contraseña de un solo uso.
 * El código real nunca se almacena — solo su hash (bcrypt).
 */
export class PasswordResetToken {
  id: string;
  userId: string;
  hashedCode: string;
  expiresAt: Date;
  usedAt: Date | null;

  static create(props: CreatePasswordResetTokenProps): PasswordResetToken {
    const token = new PasswordResetToken();
    token.id = props.id;
    token.userId = props.userId;
    token.hashedCode = props.hashedCode;
    token.expiresAt = props.expiresAt;
    token.usedAt = null;
    return token;
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }
}
