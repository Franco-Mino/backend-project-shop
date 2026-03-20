import { Product } from '../../../domain/entities/product.entity';
import { ProductImage } from '../../../domain/entities/product-image.entity';
import { ProductOrmEntity } from '../entities/product.orm-entity';
import { ProductImageOrmEntity } from '../entities/product-image.orm-entity';

/**
 * PERSISTENCE MAPPER — ProductPersistenceMapper
 *
 * Traduce entre la entidad de dominio (Product) y la entidad ORM
 * (ProductOrmEntity). Este es el único punto de contacto entre ambas
 * representaciones — el dominio nunca ve TypeORM y TypeORM nunca
 * contamina el dominio.
 *
 * Nota: TypeORM retorna columnas `decimal` como string en PostgreSQL.
 * Por eso convertimos price con Number().
 */
export class ProductPersistenceMapper {
  /** ORM Entity → Domain Entity (reconstitución desde DB) */
  static toDomain(orm: ProductOrmEntity): Product {
    const product = new Product();
    product.id = orm.id;
    product.title = orm.title;
    product.price = Number(orm.price); // TypeORM devuelve decimal como string
    product.description = orm.description ?? undefined;
    product.slug = orm.slug;
    product.stock = orm.stock;
    product.sizes = orm.sizes;
    product.gender = orm.gender;
    product.tags = orm.tags ?? [];
    product.isActive = orm.isActive;
    product.createdById = orm.createdById ?? undefined;
    product.images = (orm.images ?? []).map((img) => {
      const image = new ProductImage();
      image.id = img.id;
      image.url = img.url;
      image.isActive = img.isActive;
      return image;
    });
    return product;
  }

  /** Domain Entity → ORM Entity (para persistir) */
  static toOrm(domain: Product): ProductOrmEntity {
    const orm = new ProductOrmEntity();
    if (domain.id) orm.id = domain.id;
    orm.title = domain.title;
    orm.price = domain.price;
    orm.description = domain.description ?? null;
    orm.slug = domain.slug;
    orm.stock = domain.stock;
    orm.sizes = domain.sizes;
    orm.gender = domain.gender;
    orm.tags = domain.tags ?? [];
    orm.isActive = domain.isActive;
    orm.createdById = domain.createdById ?? null;

    if (domain.images?.length) {
      orm.images = domain.images.map((img) => {
        const ormImg = new ProductImageOrmEntity();
        if (img.id) ormImg.id = img.id;
        ormImg.url = img.url;
        ormImg.isActive = img.isActive;
        return ormImg;
      });
    }

    return orm;
  }
}
