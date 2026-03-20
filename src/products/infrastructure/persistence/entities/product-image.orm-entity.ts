import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProductOrmEntity } from './product.orm-entity';

/**
 * ORM ENTITY — ProductImageOrmEntity
 *
 * Esta es la representación de TypeORM (infraestructura).
 * Es completamente distinta a la domain entity ProductImage.
 * El mapper (ProductPersistenceMapper) traduce entre ambas.
 */
@Entity({ name: 'product_images' })
export class ProductImageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  url: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @ManyToOne(() => ProductOrmEntity, (product) => product.images)
  product: ProductOrmEntity;
}
