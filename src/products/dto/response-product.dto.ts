import { Gender } from "../enums/gender.enum";
import { ProductSize } from "../enums/product-size.enum";

export class ProductResponseDto {
    id: string;
    title: string;
    price: number;
    description: string;
    slug: string;
    stock: number;
    sizes: ProductSize[];
    gender: Gender[];
    tags: string[];
    isActive: boolean;
    images: string[];
}
