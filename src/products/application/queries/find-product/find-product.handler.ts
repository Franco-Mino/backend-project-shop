import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { FindProductQuery } from './find-product.query';
import { Product } from '../../../domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY_PORT,
  type IProductRepository,
} from '../../../domain/ports/product.repository.port';

/**
 * QUERY HANDLER — FindProductHandler
 *
 * Lee un producto por UUID o slug. Devuelve la entidad de dominio;
 * el controller la mapea a DTO de respuesta HTTP.
 *
 * Al ser una Query pura, no tiene side effects ni publica events.
 * En el futuro se puede agregar Redis aquí sin tocar nada más.
 */
@QueryHandler(FindProductQuery)
export class FindProductHandler
  implements IQueryHandler<FindProductQuery, Product>
{
  private readonly logger = new Logger(FindProductHandler.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(query: FindProductQuery): Promise<Product> {
    const product = await this.productRepository.findByTerm(query.term);
    if (!product) {
      this.logger.warn(`Product not found for term: "${query.term}"`);
      throw new NotFoundException(
        `Product with term "${query.term}" not found`,
      );
    }
    return product;
  }
}
