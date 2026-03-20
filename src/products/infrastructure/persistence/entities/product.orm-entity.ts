import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Gender } from '../../../domain/enums/gender.enum';
import { ProductSize } from '../../../domain/enums/product-size.enum';
import { ProductImageOrmEntity } from './product-image.orm-entity';

/**
 * ORM ENTITY — ProductOrmEntity
 *
 * Representación TypeORM del producto. Vive en infraestructura y es
 * completamente invisible para el dominio y la aplicación.
 *
 * Los índices de base de datos se definen aquí, no en el dominio.
 */
@Entity({ name: 'products' })
@Index(['isActive'])
@Index(['isActive', 'stock'])
@Index(['slug'], { unique: true })
export class ProductOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  title: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  price: number;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('text', { unique: true })
  slug: string;

  @Column('int', { default: 0 })
  stock: number;

  @Column({ type: 'enum', enum: ProductSize, array: true })
  sizes: ProductSize[];

  @Column({ type: 'enum', enum: Gender, array: true })
  gender: Gender[];

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @OneToMany(() => ProductImageOrmEntity, (img) => img.product, {
    cascade: true,
    eager: false,
  })
  images: ProductImageOrmEntity[];

  // UUID del admin que creó el producto. Columna simple sin FK TypeORM
  // para mantener independencia entre módulos a nivel de código.
  @Column('uuid', { nullable: true })
  createdById: string | null;
}
