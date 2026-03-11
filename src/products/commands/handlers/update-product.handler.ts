import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateProductCommand } from '../update-product.command';
import { ProductRepository } from 'src/products/repositories/product.repository';
import { SlugService } from 'src/products/services/slug.service';
import { ProductSlugService } from 'src/products/services/product-slug.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductMapper } from 'src/products/mappers/product.mapper';
import { DataSource } from 'typeorm';
import { Product } from 'src/products/entities';
import { ProductImage } from 'src/products/entities/product-image.entity';

@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler
    implements ICommandHandler<UpdateProductCommand> {
    constructor(
        private readonly productRepository: ProductRepository,
        private readonly productSlugService: ProductSlugService,
        private readonly slugService: SlugService,
        private readonly dataSource: DataSource,
    ) { }

    async execute(command: UpdateProductCommand): Promise<Product> {
        const { id, dto } = command;

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. Buscar el producto activo dentro de la transacción
            const product = await queryRunner.manager.findOne(Product, {
                where: { id, isActive: true },
            });

            if (!product) {
                throw new NotFoundException(`Product with id ${id} not found`);
            }

            // 2. Preparar los datos escalares (sin imágenes)
            const productData = ProductMapper.dtoToEntity(dto);

            // 3. Lógica de slug
            if (dto.title && dto.title !== product.title && !productData.slug) {
                productData.slug = await this.productSlugService.generateUnique(
                    dto.title,
                    id,
                    queryRunner.manager,
                );
            } else if (dto.slug && dto.slug !== product.slug) {
                const normalizedSlug = this.slugService.generate(dto.slug);

                const exists = await this.productSlugService.exists(
                    normalizedSlug,
                    id,
                    queryRunner.manager,
                );

                if (exists) {
                    throw new ConflictException(
                        `Slug "${normalizedSlug}" already exists`,
                    );
                }

                productData.slug = normalizedSlug;
            }

            // 4. Actualizar campos escalares del producto
            await queryRunner.manager.update(Product, id, productData);

            // 5. Manejo de imágenes
            if (dto.images !== undefined) {
                await this.syncImages(id, dto.images, queryRunner.manager);
            }

            // 6. Confirmar la transacción
            await queryRunner.commitTransaction();

            // 7. Retornar el producto actualizado con sus imágenes activas
            const updated = await this.productRepository.findOneActiveBy(id);

            if (!updated) {
                throw new NotFoundException(
                    `Product with id ${id} not found after update`,
                );
            }

            return updated;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Sincroniza las imágenes de un producto aplicando un diff por URL.
     *
     * Reglas:
     * - URL en incomingUrls que NO existía → crear con isActive: true
     * - URL en incomingUrls que YA existía → no tocar
     * - URL que existía pero NO está en incomingUrls → soft delete (isActive: false)
     * - incomingUrls vacío → soft delete de todas las imágenes actuales
     *
     * @param productId    - ID del producto
     * @param incomingUrls - Lista de URLs enviadas por el cliente
     * @param manager      - EntityManager transaccional del QueryRunner
     */
    private async syncImages(
        productId: string,
        incomingUrls: string[],
        manager: import('typeorm').EntityManager,
    ): Promise<void> {
        // Obtener todas las imágenes activas actuales del producto
        const currentImages = await manager.find(ProductImage, {
            where: { product: { id: productId }, isActive: true },
        });

        const currentUrlSet = new Set(currentImages.map((img) => img.url));
        const incomingUrlSet = new Set(incomingUrls);

        // URLs que ya no están en la nueva lista → soft delete
        const toDeactivate = currentImages.filter(
            (img) => !incomingUrlSet.has(img.url),
        );

        if (toDeactivate.length > 0) {
            const idsToDeactivate = toDeactivate.map((img) => img.id);

            await manager
                .createQueryBuilder()
                .update(ProductImage)
                .set({ isActive: false })
                .whereInIds(idsToDeactivate)
                .execute();
        }

        // URLs nuevas que no existían → crear
        const urlsToCreate = incomingUrls.filter(
            (url) => !currentUrlSet.has(url),
        );

        if (urlsToCreate.length > 0) {
            const newImages = urlsToCreate.map((url) =>
                manager.create(ProductImage, {
                    url,
                    isActive: true,
                    product: { id: productId },
                }),
            );

            await manager.save(ProductImage, newImages);
        }
    }
}