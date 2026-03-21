import { User } from '../entities/user.entity';

/**
 * PORT (interfaz de salida) — IUserRepository
 *
 * El dominio define QUÉ necesita. No sabe si hay PostgreSQL,
 * MongoDB o un Map en memoria detrás.
 */
export const USER_REPOSITORY_PORT = 'USER_REPOSITORY_PORT';

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface IUserRepository {
  create(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findAll(options: PaginationOptions): Promise<User[]>;
  update(
    id: string,
    changes: Partial<
      Pick<User, 'email' | 'fullName' | 'password' | 'roles' | 'isActive'>
    >,
  ): Promise<User>;
  incrementFailedAttempts(id: string): Promise<void>;
  resetFailedAttempts(id: string): Promise<void>;
}
