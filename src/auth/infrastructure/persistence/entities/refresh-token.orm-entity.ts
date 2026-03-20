import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserOrmEntity } from './user.orm-entity';

/**
 * ORM ENTITY — RefreshTokenOrmEntity
 *
 * Almacena los jti (JWT IDs) de refresh tokens activos.
 * Permite revocación individual o global por usuario.
 * El JWT firmado nunca se almacena — solo su identificador.
 */
@Entity({ name: 'refresh_tokens' })
export class RefreshTokenOrmEntity {
  @PrimaryColumn('uuid')
  id: string; // jti

  @Index()
  @Column('uuid')
  userId: string;

  @Column('timestamptz')
  expiresAt: Date;

  @Column('timestamptz', { nullable: true, default: null })
  revokedAt: Date | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  user: UserOrmEntity;
}
