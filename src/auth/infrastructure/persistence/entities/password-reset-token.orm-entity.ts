import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserOrmEntity } from './user.orm-entity';

/**
 * ORM ENTITY — PasswordResetTokenOrmEntity
 *
 * Tabla: password_reset_tokens
 * Almacena el hash del código de recuperación, no el código plano.
 */
@Entity({ name: 'password_reset_tokens' })
export class PasswordResetTokenOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('text')
  hashedCode: string;

  @Column('timestamp')
  expiresAt: Date;

  @Column('timestamp', { nullable: true })
  usedAt: Date | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  user: UserOrmEntity;
}
