import { Product } from '../../../domain/entities/product.entity';
import { ProductResponseDto } from '../dto/product.response.dto';

/**
 * HTTP MAPPER — ProductHttpMapper
 *
 * Traduce entidades de dominio (Product) al DTO de respuesta HTTP.
 * Vive en infraestructura/http porque es una preocupación de presentación:
 * filtra imágenes inactivas, formatea campos, etc.
 *
 * Si el dominio cambia internamente, solo este mapper cambia — los tests
 * del dominio no se ven afectados.
 */
export class ProductHttpMapper {
  static toResponse(product: Product): ProductResponseDto {
    return {
      id: product.id,
      title: product.title,
      price: product.price,
      description: product.description,
      slug: product.slug,
      stock: product.stock,
      sizes: product.sizes,
      gender: product.gender,
      tags: product.tags,
      isActive: product.isActive,
      images: (product.images ?? [])
        .filter((img) => img.isActive)
        .map((img) => img.url),
    };
  }

  static toResponseMany(products: Product[]): ProductResponseDto[] {
    return products.map((p) => ProductHttpMapper.toResponse(p));
  }
}
