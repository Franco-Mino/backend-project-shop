import { Gender } from '../../../domain/enums/gender.enum';
import { ProductSize } from '../../../domain/enums/product-size.enum';

/**
 * COMMAND — UpdateProductCommand
 *
 * Representa la intención de actualizar un producto existente.
 *
 * `keepImages`: URLs de S3 ya existentes que el cliente quiere conservar.
 * `files`: nuevos archivos a subir. El total keepImages + files debe ser ≤ 5.
 *
 * Si no se envían ni keepImages ni files, las imágenes no se modifican.
 */
export class UpdateProductCommand {
  readonly id: string;
  readonly title?: string;
  readonly price?: number;
  readonly description?: string;
  readonly slug?: string;
  readonly stock?: number;
  readonly sizes?: ProductSize[];
  readonly gender?: Gender[];
  readonly tags?: string[];
  readonly keepImages?: string[];
  readonly files?: Express.Multer.File[];

  constructor(props: {
    id: string;
    title?: string;
    price?: number;
    description?: string;
    slug?: string;
    stock?: number;
    sizes?: ProductSize[];
    gender?: Gender[];
    tags?: string[];
    keepImages?: string[];
    files?: Express.Multer.File[];
  }) {
    Object.assign(this, props);
  }
}
