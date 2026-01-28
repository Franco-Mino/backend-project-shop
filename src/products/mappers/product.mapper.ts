import { CreateProductDto } from '../dto/create-product.dto';
import { Product } from '../entities/product.entity';
import { Gender } from '../enums/gender.enum';
import { ProductSize } from '../enums/product-size.enum';

export class ProductMapper {
    static dtoToEntity(dto: Partial<CreateProductDto>): Partial<Product> {
        const result: Partial<Product> = {};

        if (dto.title) result.title = dto.title;
        if (dto.price !== undefined) result.price = dto.price;
        if (dto.description !== undefined) result.description = dto.description;
        if (dto.slug) result.slug = dto.slug;
        if (dto.stock !== undefined) result.stock = dto.stock;

        if (dto.sizes) {
            const sizes = Array.isArray(dto.sizes) ? dto.sizes : [dto.sizes];
            result.sizes = sizes.map(s => s as ProductSize);
        }

        if (dto.gender) {
            const genders = Array.isArray(dto.gender) ? dto.gender : [dto.gender];
            result.gender = genders.map(g => g as Gender);
        }

        return result;
    }
}

