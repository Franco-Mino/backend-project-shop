import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProductRepository } from './repositories/product.repository';
import { PaginationDto } from '../common/pagination/dto/pagination.dto';
import { ProductResponseDto } from './dto/response-product.dto';
import { ProductMapper } from './mappers/product.mapper';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly productRepository: ProductRepository) { }

  async findAll({ limit = 10, offset = 0 }: PaginationDto): Promise<ProductResponseDto[]> {
    try {
      const products = await this.productRepository.findActive({ limit, offset });
      return ProductMapper.toResponseMany(products);
    } catch (error) {
      this.logger.error('Error fetching products', error);
      throw error;
    }
  }

  async findOne(term: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOneActiveBy(term);

    if (!product) {
      throw new NotFoundException(`Product with term '${term}' not found`);
    }

    return ProductMapper.toResponse(product);
  }
}