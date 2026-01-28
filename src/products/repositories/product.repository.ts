import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';

/**
 * PRODUCT REPOSITORY - Operaciones especializadas
 * 
 * Responsabilidad: Queries eficientes
 * Simple, sin complejidad innecesaria
 */
@Injectable()
export class ProductRepository extends Repository<Product> {

    constructor(dataSource: DataSource) {
        super(Product, dataSource.createEntityManager());
    }

    /**
     * Obtener solo productos activos
     * O(log n) con índice isActive
     */
    async findActive({ take = 10, skip = 0 }: { take?: number; skip?: number }) {
        return this.find({
            where: { isActive: true },
            take,
            skip,
        });
    }

    /**
     * Soft delete: marca como inactivo
     */
    async softDelete(id: string) {
        return this.update({ id }, { isActive: false });
    }

    /**
     * Hard delete: elimina permanente de BD
     */
    async hardDelete(id: string) {
        return this.delete({ id });
    }
}
