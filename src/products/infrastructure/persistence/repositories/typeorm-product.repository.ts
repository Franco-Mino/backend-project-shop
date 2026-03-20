import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import {
  IProductRepository,
  PaginationOptions,
} from '../../../domain/ports/product.repository.port';
import { Product } from '../../../domain/entities/product.entity';
import { ProductOrmEntity } from '../entities/product.orm-entity';
import { ProductImageOrmEntity } from '../entities/product-image.orm-entity';
import { ProductPersistenceMapper } from '../mappers/product.persistence-mapper';

/**
 * ADAPTER — TypeOrmProductRepository
 *
 * Implementación concreta del port IProductRepository usando TypeORM.
 * Esta clase es infraestructura pura: conoce PostgreSQL, QueryBuilder,
 * transacciones, pero el resto de la app no la conoce directamente
 * — solo conoce el contrato IProductRepository.
 *
 * Si mañana migran a Prisma o MongoDB, solo se reemplaza esta clase.
 * El dominio y la aplicación no cambian.
 */
@Injectable()
export class TypeOrmProductRepository implements IProductRepository {
  constructor(
    @InjectRepository(ProductOrmEntity)
    private readonly productRepo: Repository<ProductOrmEntity>,
    @InjectRepository(ProductImageOrmEntity)
    private readonly imageRepo: Repository<ProductImageOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(product: Product): Promise<Product> {
    const orm = ProductPersistenceMapper.toOrm(product);
    const saved = await this.productRepo.save(orm); // cascade saves images
    const reloaded = await this.findOrmById(saved.id);
    return ProductPersistenceMapper.toDomain(reloaded!);
  }

  /**
   * Actualiza campos escalares y opcionalmente sincroniza imágenes,
   * todo en una sola transacción para garantizar consistencia.
   */
  async update(
    id: string,
    changes: Partial<Product>,
    imageFinalUrls?: string[],
  ): Promise<Product> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updateData: Partial<ProductOrmEntity> = {};
      if (changes.title !== undefined) updateData.title = changes.title;
      if (changes.price !== undefined) updateData.price = changes.price;
      if (changes.description !== undefined)
        updateData.description = changes.description;
      if (changes.slug !== undefined) updateData.slug = changes.slug;
      if (changes.stock !== undefined) updateData.stock = changes.stock;
      if (changes.sizes !== undefined) updateData.sizes = changes.sizes;
      if (changes.gender !== undefined) updateData.gender = changes.gender;
      if (changes.tags !== undefined) updateData.tags = changes.tags;

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(ProductOrmEntity, id, updateData);
      }

      if (imageFinalUrls !== undefined) {
        await this.syncImagesInTransaction(
          id,
          imageFinalUrls,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();

      const updated = await this.findOrmById(id);
      return ProductPersistenceMapper.toDomain(updated!);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.productRepo.update(id, { isActive: false });
  }

  async findById(id: string): Promise<Product | null> {
    const orm = await this.productRepo.findOne({
      where: { id, isActive: true },
      relations: { images: true },
    });
    return orm ? ProductPersistenceMapper.toDomain(orm) : null;
  }

  async findByTerm(term: string): Promise<Product | null> {
    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect(
        'product.images',
        'image',
        'image.isActive = :imgActive',
        { imgActive: true },
      )
      .where('product.isActive = :isActive', { isActive: true });

    if (isUUID(term)) {
      qb.andWhere('product.id = :id', { id: term });
    } else {
      qb.andWhere('LOWER(product.slug) = LOWER(:slug)', {
        slug: term.trim(),
      });
    }

    const orm = await qb.getOne();
    return orm ? ProductPersistenceMapper.toDomain(orm) : null;
  }

  async findAll(options: PaginationOptions): Promise<Product[]> {
    const orms = await this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect(
        'product.images',
        'image',
        'image.isActive = :imgActive',
        { imgActive: true },
      )
      .where('product.isActive = :isActive', { isActive: true })
      .take(options.limit)
      .skip(options.offset)
      .getMany();

    return orms.map((orm) => ProductPersistenceMapper.toDomain(orm));
  }

  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const qb = this.productRepo
      .createQueryBuilder('product')
      .where('product.slug = :slug', { slug });

    if (excludeId) {
      qb.andWhere('product.id != :id', { id: excludeId });
    }

    return !!(await qb.getOne());
  }

  // ─── Helpers privados ────────────────────────────────────────────────────────

  private async findOrmById(id: string): Promise<ProductOrmEntity | null> {
    return this.productRepo.findOne({
      where: { id },
      relations: { images: true },
    });
  }

  /**
   * Sincroniza las imágenes de un producto dentro de una transacción existente.
   * - Desactiva las que ya no están en la lista final
   * - Crea las que son nuevas
   */
  private async syncImagesInTransaction(
    productId: string,
    finalUrls: string[],
    manager: EntityManager,
  ): Promise<void> {
    const currentImages = await manager.find(ProductImageOrmEntity, {
      where: { product: { id: productId }, isActive: true },
    });

    const currentUrlSet = new Set(currentImages.map((img) => img.url));
    const finalUrlSet = new Set(finalUrls);

    const toDeactivate = currentImages.filter(
      (img) => !finalUrlSet.has(img.url),
    );

    if (toDeactivate.length > 0) {
      await manager
        .createQueryBuilder()
        .update(ProductImageOrmEntity)
        .set({ isActive: false })
        .whereInIds(toDeactivate.map((img) => img.id))
        .execute();
    }

    const urlsToCreate = finalUrls.filter((url) => !currentUrlSet.has(url));

    if (urlsToCreate.length > 0) {
      const newImages = urlsToCreate.map((url) =>
        manager.create(ProductImageOrmEntity, {
          url,
          isActive: true,
          product: { id: productId },
        }),
      );
      await manager.save(ProductImageOrmEntity, newImages);
    }
  }
}
