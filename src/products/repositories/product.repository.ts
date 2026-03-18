import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { Product } from '../entities';
import { PaginationDto } from '../../common/pagination/dto/pagination.dto';

@Injectable()
export class ProductRepository extends Repository<Product> {

  constructor(dataSource: DataSource) {
    super(Product, dataSource.createEntityManager());
  }

  async findActive({ limit, offset }: PaginationDto): Promise<Product[]> {
    return this.createQueryBuilder('product')
      .leftJoinAndSelect(
        'product.images',
        'image',
        'image.isActive = :imgActive',
        { imgActive: true },
      )
      .where('product.isActive = :isActive', { isActive: true })
      .take(limit)
      .skip(offset)
      .getMany();
  }

  async findOneActiveBy(term: string): Promise<Product | null> {
    if (!term?.trim()) {
      throw new BadRequestException('Search term cannot be empty');
    }

    const queryBuilder = this.createQueryBuilder('product')
      .leftJoinAndSelect(
        'product.images',
        'image',
        'image.isActive = :imgActive',
        { imgActive: true },
      )
      .where('product.isActive = :isActive', { isActive: true });

    if (isUUID(term)) {
      queryBuilder.andWhere('product.id = :term', { term });
    } else {
      queryBuilder.andWhere('LOWER(product.slug) = LOWER(:term)', { term: term.trim() });
    }

    return queryBuilder.getOne();
  }
}
