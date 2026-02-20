import { Product } from '../entities';
import { ProductResponseDto } from '../dto/response-product.dto';
import { CreateProductDto } from '../dto/create-product.dto';
import { Gender } from '../enums/gender.enum';
import { ProductSize } from '../enums/product-size.enum';

export class ProductMapper {

    static dtoToEntity(dto: Partial<CreateProductDto>): Partial<Product> {
        const entity: Partial<Product> = {};

        if (dto.title) entity.title = dto.title;
        if (dto.price !== undefined) entity.price = dto.price;
        if (dto.description) entity.description = dto.description;
        if (dto.slug) entity.slug = dto.slug;
        if (dto.stock !== undefined) entity.stock = dto.stock;
        if (dto.tags) entity.tags = dto.tags;
        if (dto.sizes) entity.sizes = dto.sizes as ProductSize[];
        if (dto.gender) entity.gender = dto.gender as Gender[];
        if (dto.sizes) {
            entity.sizes = (Array.isArray(dto.sizes) ? dto.sizes : [dto.sizes]) as ProductSize[];
        }
        if (dto.gender) {
            entity.gender = (Array.isArray(dto.gender) ? dto.gender : [dto.gender]) as Gender[];
        }
        return entity;
    }

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
            images: product.images?.map(img => img.url) ?? [],
        };
    }

    static toResponseMany(products: Product[]): ProductResponseDto[] {
        return products.map(product => this.toResponse(product));
    }
}