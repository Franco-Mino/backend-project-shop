import * as bcrypt from 'bcrypt';

/**
 * DOMAIN SERVICE — PasswordDomainService
 *
 * Encapsula las reglas de hashing de contraseñas.
 * bcrypt es una utilidad criptográfica pura (sin I/O ni red),
 * por eso vive en el dominio — igual que randomUUID() en product.
 */
export class PasswordDomainService {
  private readonly SALT_ROUNDS = 10;

  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.SALT_ROUNDS);
  }

  async compare(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
