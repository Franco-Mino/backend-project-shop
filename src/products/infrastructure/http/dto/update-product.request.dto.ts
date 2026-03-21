import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateProductRequestDto } from './create-product.request.dto';

/**
 * HTTP REQUEST DTO — UpdateProductRequestDto
 *
 * Extiende el DTO de creación (todos los campos opcionales) y agrega
 * `keepImages`: lista de URLs de S3 existentes que el cliente quiere conservar.
 */
export class UpdateProductRequestDto extends PartialType(
  CreateProductRequestDto,
) {
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown[] =>
    Array.isArray(value) ? (value as unknown[]) : value ? [value] : [],
  )
  @IsArray()
  @IsString({ each: true })
  keepImages?: string[];
}
