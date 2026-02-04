import { CreateProductDto } from '../dto/create-product.dto';
import { Product } from '../entities';
import { Gender } from '../enums/gender.enum';
import { ProductSize } from '../enums/product-size.enum';



// 1. Definimos la interfaz (Contrato)
export interface IProductEntityData extends Partial<Pick<Product,
    'title' | 'price' | 'description' | 'slug' | 'stock' | 'tags' | 'sizes' | 'gender'
>> { }




export class ProductMapper {
    static dtoToEntity(dto: Partial<CreateProductDto>): IProductEntityData {
        const result: IProductEntityData = {};

        if (dto.title) result.title = dto.title;
        if (dto.price !== undefined) result.price = dto.price;
        if (dto.description !== undefined) result.description = dto.description;
        if (dto.slug) result.slug = dto.slug;
        if (dto.stock !== undefined) result.stock = dto.stock;
        if (dto.tags) result.tags = dto.tags;
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

