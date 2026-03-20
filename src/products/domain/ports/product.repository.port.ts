import { Product } from '../entities/product.entity';

/**
 * PORT (interfaz de salida) — IProductRepository
 *
 * Regla: Este archivo es parte del dominio. Define el CONTRATO que la
 * infraestructura debe cumplir. El dominio no sabe si detrás hay PostgreSQL,
 * MongoDB o un array en memoria.
 *
 * La implementación concreta vive en:
 *   infrastructure/persistence/repositories/typeorm-product.repository.ts
 */

export const PRODUCT_REPOSITORY_PORT = 'PRODUCT_REPOSITORY_PORT';

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface IProductRepository {
  /** Crea un producto nuevo con sus imágenes (operación atómica) */
  create(product: Product): Promise<Product>;

  /**
   * Actualiza campos escalares de un producto. Si se proveen imageFinalUrls,
   * sincroniza las imágenes en la misma transacción (operación atómica).
   */
  update(
    id: string,
    changes: Partial<Product>,
    imageFinalUrls?: string[],
  ): Promise<Product>;

  /** Soft delete: setea isActive = false */
  softDelete(id: string): Promise<void>;

  /** Busca por UUID */
  findById(id: string): Promise<Product | null>;

  /** Busca por UUID o slug (para el endpoint GET /products/:term) */
  findByTerm(term: string): Promise<Product | null>;

  /** Listado paginado de productos activos */
  findAll(options: PaginationOptions): Promise<Product[]>;

  /** Verifica unicidad del slug, excluyendo opcionalmente un ID propio */
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
}
