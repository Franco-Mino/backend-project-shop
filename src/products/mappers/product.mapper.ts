import { CreateProductDto } from '../dto/create-product.dto';
import { Product } from '../entities/product.entity';
import { Gender } from '../enums/gender.enum';
import { ProductSize } from '../enums/product-size.enum';

export class ProductMapper {
    static dtoToEntity(dto: CreateProductDto): Partial<Product> {
        const genders = Array.isArray(dto.gender) ? dto.gender : [dto.gender];
        const sizes = Array.isArray(dto.sizes) ? dto.sizes : [dto.sizes];
        return {
            title: dto.title,
            price: dto.price,
            description: dto.description,
            slug: dto.slug,
            stock: dto.stock,
            sizes: sizes.map(s => s as ProductSize),
            gender: genders.map(g => g as Gender),
        };
    }
}
