import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';

import { ProductRepository } from './repositories/product.repository';
import { PaginationDto } from '../common/pagination/dto/pagination.dto';
import { isUUID } from 'class-validator';
import { Product } from './entities/product.entity';


@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService');

  constructor(
    private readonly productRepository: ProductRepository,
  ) { }

  // Solo traigo los productos activos ⭐
  async findAll(paginationDto: PaginationDto) {
    try {
      const { limit, offset } = paginationDto;
      const date = await this.productRepository.findActive({
        take: limit,
        skip: offset,
      });
      return date
    } catch (error) {
      this.logger.error('Error fetching products:', error);
    }
  }

  // Solo traigo 1 producto activo por ID o SLUG ⭐
  async findOne(term: string): Promise<Product> {
    try {
      const queryCondition = isUUID(term)
        ? { id: term, isActive: true }
        : { slug: term, isActive: true };

      const product = await this.productRepository.findOneBy(queryCondition);

      if (!product) {
        throw new NotFoundException(`Product with term '${term}' not found`);
      }

      return product;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error finding product ${term}:`, error);
      throw new InternalServerErrorException('Error finding product');
    }
  }



}
