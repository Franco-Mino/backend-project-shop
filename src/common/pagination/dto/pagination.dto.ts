import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Min } from 'class-validator';

export class PaginationDto {

  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset: number = 0;
}
