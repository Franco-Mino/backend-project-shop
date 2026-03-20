import { Gender } from '../../../domain/enums/gender.enum';
import { ProductSize } from '../../../domain/enums/product-size.enum';

/**
 * HTTP RESPONSE DTO — ProductResponseDto
 *
 * Forma exacta en que el producto se expone al cliente HTTP.
 * Esta representación puede diferir del dominio (ej: sin isActive,
 * o con campos calculados) sin afectar la entidad de dominio.
 */
export class ProductResponseDto {
  id: string;
  title: string;
  price: number;
  description?: string;
  slug: string;
  stock: number;
  sizes: ProductSize[];
  gender: Gender[];
  tags: string[];
  isActive: boolean;
  images: string[];
}
