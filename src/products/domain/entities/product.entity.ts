import { ProductImage } from './product-image.entity';
import { Gender } from '../enums/gender.enum';
import { ProductSize } from '../enums/product-size.enum';

export interface CreateProductProps {
  id: string;
  title: string;
  price: number;
  stock: number;
  sizes: ProductSize[];
  gender: Gender[];
  slug: string;
  description?: string;
  tags?: string[];
  images?: ProductImage[];
  createdById?: string;
}

/**
 * DOMAIN ENTITY — Product (Aggregate Root)
 *
 * Regla: Cero dependencias de framework. Solo TypeScript puro.
 * Contiene las reglas de negocio del producto.
 *
 * El ID lo genera el handler de aplicación (con randomUUID) antes de
 * persistir, para que el dominio sea dueño del ciclo de vida de la entidad.
 */
export class Product {
  id: string;
  title: string;
  price: number;
  description?: string;
  slug: string;
  stock: number;
  sizes: ProductSize[];
  gender: Gender[];
  tags: string[];
  images: ProductImage[];
  isActive: boolean;
  createdById?: string;

  /**
   * Factory para crear un producto nuevo.
   * La reconstitución desde DB la hace ProductPersistenceMapper.
   */
  static create(props: CreateProductProps): Product {
    const product = new Product();
    product.id = props.id;
    product.title = props.title;
    product.price = props.price ?? 0;
    product.stock = props.stock ?? 0;
    product.sizes = props.sizes;
    product.gender = props.gender;
    product.slug = props.slug;
    product.description = props.description;
    product.tags = props.tags ?? [];
    product.images = props.images ?? [];
    product.isActive = true;
    product.createdById = props.createdById;
    return product;
  }

  /** Regla de negocio: soft delete */
  deactivate(): void {
    this.isActive = false;
  }

  /** Regla de negocio: un producto inactivo no puede editarse */
  isEditable(): boolean {
    return this.isActive;
  }
}
