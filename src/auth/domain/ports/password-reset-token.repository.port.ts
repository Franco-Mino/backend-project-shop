import { PasswordResetToken } from '../entities/password-reset-token.entity';

export const PASSWORD_RESET_TOKEN_REPOSITORY_PORT =
  'PASSWORD_RESET_TOKEN_REPOSITORY_PORT';

export interface IPasswordResetTokenRepository {
  create(token: PasswordResetToken): Promise<PasswordResetToken>;
  /** Devuelve el token activo (no usado, no expirado) del usuario */
  findActiveByUserId(userId: string): Promise<PasswordResetToken | null>;
  markAsUsed(id: string): Promise<void>;
  /** Limpia todos los tokens del usuario antes de emitir uno nuevo */
  deleteByUserId(userId: string): Promise<void>;
}
