import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { Product } from '../entities';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';

@Injectable()
export class ProductRepository extends Repository<Product> {

    constructor(dataSource: DataSource) {
        super(Product, dataSource.createEntityManager());
    }

    async findActive({ limit = 10, offset = 0 }: PaginationDto): Promise<Product[]> {
        return this.find({
            where: { isActive: true },
            relations: { images: true },
            take: limit,
            skip: offset,
        });
    }

    async findOneActiveBy(term: string): Promise<Product | null> {
        if (!term?.trim()) {
            throw new BadRequestException('Search term cannot be empty');
        }

        const QueryBuilder = this.createQueryBuilder('product')
            .leftJoinAndSelect('product.images', 'image')
            .where('product.isActive = :isActive', { isActive: true });

        if (isUUID(term)) {
            QueryBuilder.andWhere('product.id = :term', { term });
        } else {
            QueryBuilder.andWhere('LOWER(product.slug) = LOWER(:term)', { term: term.trim() });
        }

        return QueryBuilder.getOne();
    }
}