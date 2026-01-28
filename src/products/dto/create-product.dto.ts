import { IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, MinLength } from "class-validator";
import { Gender } from "../enums/gender.enum";
import { ProductSize } from "../enums/product-size.enum";

export class CreateProductDto {

    @IsString()
    @MinLength(2)
    title: string;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    price?: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    slug?: string;

    @IsInt()
    @IsOptional()
    @IsPositive()
    stock?: number;

    @IsEnum(ProductSize, { each: true })
    sizes: ProductSize[];

    @IsEnum(Gender, { each: true })
    gender: string[];


    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags: string[];
}

