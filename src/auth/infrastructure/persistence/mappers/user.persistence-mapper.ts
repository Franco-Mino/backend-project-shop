import { User } from '../../../domain/entities/user.entity';
import { UserOrmEntity } from '../entities/user.orm-entity';

/**
 * PERSISTENCE MAPPER — UserPersistenceMapper
 *
 * Único punto de contacto entre User (dominio) y UserOrmEntity (TypeORM).
 * El dominio nunca ve TypeORM. TypeORM nunca contamina el dominio.
 */
export class UserPersistenceMapper {
  static toDomain(orm: UserOrmEntity): User {
    const user = new User();
    user.id = orm.id;
    user.email = orm.email;
    user.password = orm.password;
    user.fullName = orm.fullName;
    user.roles = orm.roles;
    user.isActive = orm.isActive;
    user.failedLoginAttempts = orm.failedLoginAttempts ?? 0;
    return user;
  }

  static toOrm(domain: User): UserOrmEntity {
    const orm = new UserOrmEntity();
    if (domain.id) orm.id = domain.id;
    orm.email = domain.email;
    orm.password = domain.password;
    orm.fullName = domain.fullName;
    orm.roles = domain.roles;
    orm.isActive = domain.isActive;
    orm.failedLoginAttempts = domain.failedLoginAttempts ?? 0;
    return orm;
  }
}
