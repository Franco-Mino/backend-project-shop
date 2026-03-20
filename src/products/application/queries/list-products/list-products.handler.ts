import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListProductsQuery } from './list-products.query';
import { Product } from '../../../domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY_PORT,
  type IProductRepository,
} from '../../../domain/ports/product.repository.port';

/**
 * QUERY HANDLER — ListProductsHandler
 *
 * Lee la lista paginada de productos activos.
 * Capa ideal para agregar Redis cache en el futuro:
 * solo hay que envolver esta lógica con cache-aside pattern.
 */
@QueryHandler(ListProductsQuery)
export class ListProductsHandler
  implements IQueryHandler<ListProductsQuery, Product[]>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(query: ListProductsQuery): Promise<Product[]> {
    return this.productRepository.findAll({
      limit: query.limit,
      offset: query.offset,
    });
  }
}
