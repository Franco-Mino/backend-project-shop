import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';

@Injectable()
export class ProductTransactionService {
    private readonly logger = new Logger('ProductTransactionService');

    constructor(private readonly dataSource: DataSource) { }

    /**
     * Crea un producto con sus imágenes en una transacción atómica
     * @param productData - Datos del producto (ya debe incluir el slug generado)
     * @param imageUrls - Array de URLs de imágenes
     * @returns El producto creado con sus imágenes
     */
    async createWithImages(
        productData: Partial<Product>,
        imageUrls: string[]
    ): Promise<Product> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const product = await this.saveProductWithImages(
                queryRunner,
                productData,
                imageUrls
            );

            await queryRunner.commitTransaction();
            this.logger.log(`Product created successfully: ${product.id}`);

            return product;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Transaction failed, rolling back', error);
            throw error; // Re-lanzamos el error para que ProductsService lo maneje
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Guarda el producto con sus imágenes usando el QueryRunner
     */
    private async saveProductWithImages(
        queryRunner: QueryRunner,
        productData: Partial<Product>,
        imageUrls: string[]
    ): Promise<Product> {
        // Crear instancia del producto con las imágenes relacionadas
        const product = queryRunner.manager.create(Product, {
            ...productData,
            images: imageUrls.map(url =>
                queryRunner.manager.create(ProductImage, { url })
            ),
        });

        // Guardar producto (cascade guardará también las imágenes)
        return await queryRunner.manager.save(Product, product);
    }
}