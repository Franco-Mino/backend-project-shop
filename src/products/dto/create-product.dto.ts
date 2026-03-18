import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Gender } from '../enums/gender.enum';
import { ProductSize } from '../enums/product-size.enum';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  stock?: number;

  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  @IsArray()
  @IsEnum(ProductSize, { each: true })
  sizes: ProductSize[];

  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  @IsArray()
  @IsEnum(Gender, { each: true })
  gender: Gender[];

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  // Used internally — not sent in request body (images come as files)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
