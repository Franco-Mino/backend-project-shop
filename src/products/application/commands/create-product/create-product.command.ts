import { Gender } from '../../../domain/enums/gender.enum';
import { ProductSize } from '../../../domain/enums/product-size.enum';

/**
 * COMMAND — CreateProductCommand
 *
 * Representa la INTENCIÓN de crear un producto. Es inmutable y lleva
 * todos los datos necesarios para ejecutar el caso de uso.
 *
 * Regla CQRS: los Commands cambian estado y NO devuelven datos complejos
 * (devolvemos el Product del dominio que el controller mapea a DTO).
 *
 * Acepta `files` (upload HTTP) o `images` (URLs directas del seed/tests).
 */
export class CreateProductCommand {
  readonly title: string;
  readonly price?: number;
  readonly description?: string;
  readonly slug?: string;
  readonly stock?: number;
  readonly sizes: ProductSize[];
  readonly gender: Gender[];
  readonly tags?: string[];
  /** URLs directas — usado por el seed o tests de integración */
  readonly images?: string[];
  /** Archivos reales — usado por el endpoint HTTP */
  readonly files?: Express.Multer.File[];
  /** UUID del admin autenticado que crea el producto */
  readonly createdById?: string;

  constructor(props: {
    title: string;
    sizes: ProductSize[];
    gender: Gender[];
    price?: number;
    description?: string;
    slug?: string;
    stock?: number;
    tags?: string[];
    images?: string[];
    files?: Express.Multer.File[];
    createdById?: string;
  }) {
    Object.assign(this, props);
  }
}
