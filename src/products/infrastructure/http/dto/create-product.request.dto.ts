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
import { Gender } from '../../../domain/enums/gender.enum';
import { ProductSize } from '../../../domain/enums/product-size.enum';

/**
 * HTTP REQUEST DTO — CreateProductRequestDto
 *
 * Vive en infraestructura/http. Solo valida la entrada HTTP.
 * No se pasa al dominio directamente: el controller lo convierte
 * en un CreateProductCommand.
 *
 * Los transforms manejan los valores que llegan como string desde
 * multipart/form-data (price="29.99", stock="10", sizes="XS", etc.)
 */
export class CreateProductRequestDto {
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

  @Transform(({ value }: { value: unknown }): unknown[] =>
    Array.isArray(value) ? (value as unknown[]) : value ? [value] : [],
  )
  @IsArray()
  @IsEnum(ProductSize, { each: true })
  sizes: ProductSize[];

  @Transform(({ value }: { value: unknown }): unknown[] =>
    Array.isArray(value) ? (value as unknown[]) : value ? [value] : [],
  )
  @IsArray()
  @IsEnum(Gender, { each: true })
  gender: Gender[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown[] =>
    Array.isArray(value) ? (value as unknown[]) : value ? [value] : [],
  )
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
