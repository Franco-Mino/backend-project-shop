import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../../domain/enums/role.enum';

/**
 * ORM ENTITY — UserOrmEntity
 *
 * Representación TypeORM del usuario. Solo existe en infraestructura.
 * El dominio User nunca toca esta clase.
 */
@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  email: string;

  @Column('text', { select: false })
  password: string;

  @Column('text')
  fullName: string;

  @Column({ type: 'enum', enum: Role, array: true, default: [Role.USER] })
  roles: Role[];

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('int', { default: 0 })
  failedLoginAttempts: number;
}
