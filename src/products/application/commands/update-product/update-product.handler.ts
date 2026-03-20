import {
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateProductCommand } from './update-product.command';
import { Product } from '../../../domain/entities/product.entity';
import { SlugDomainService } from '../../../domain/services/slug.domain-service';
import {
  PRODUCT_REPOSITORY_PORT,
  type IProductRepository,
} from '../../../domain/ports/product.repository.port';
import {
  STORAGE_SERVICE_PORT,
  type IStorageService,
} from '../../../domain/ports/storage.service.port';

const MAX_IMAGES = 5;
const S3_FOLDER = 'products';

/**
 * COMMAND HANDLER — UpdateProductHandler
 *
 * Orquesta el caso de uso "actualizar producto":
 *   1. Verifica que el producto existe
 *   2. Valida unicidad de slug si cambió
 *   3. Sube nuevos archivos a S3
 *   4. Delega la actualización atómica (fields + imagen sync) al repositorio
 *   5. Rollback de S3 si la DB falla
 */
@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler
  implements ICommandHandler<UpdateProductCommand, Product>
{
  private readonly logger = new Logger(UpdateProductHandler.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IProductRepository,
    @Inject(STORAGE_SERVICE_PORT)
    private readonly storageService: IStorageService,
    private readonly slugService: SlugDomainService,
  ) {}

  async execute(command: UpdateProductCommand): Promise<Product> {
    const { id, files = [], keepImages, ...props } = command;

    // 1. Verificar existencia
    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    // 2. Resolver slug si title o slug cambiaron
    const changes: Partial<Product> = {};
    if (props.title !== undefined) changes.title = props.title;
    if (props.price !== undefined) changes.price = props.price;
    if (props.description !== undefined) changes.description = props.description;
    if (props.stock !== undefined) changes.stock = props.stock;
    if (props.sizes !== undefined) changes.sizes = props.sizes;
    if (props.gender !== undefined) changes.gender = props.gender;
    if (props.tags !== undefined) changes.tags = props.tags;

    if (props.slug && props.slug !== existing.slug) {
      const normalized = this.slugService.generate(props.slug);
      const exists = await this.productRepository.existsBySlug(normalized, id);
      if (exists) {
        throw new ConflictException(`Slug "${normalized}" already exists`);
      }
      changes.slug = normalized;
    } else if (props.title && props.title !== existing.title && !props.slug) {
      const normalized = this.slugService.generate(props.title);
      const exists = await this.productRepository.existsBySlug(normalized, id);
      if (exists) {
        throw new ConflictException(
          `Slug "${normalized}" already exists. Please provide a custom slug.`,
        );
      }
      changes.slug = normalized;
    }

    // 3. Determinar imagen final (solo si el cliente envía algo relacionado a imágenes)
    let imageFinalUrls: string[] | undefined;
    const uploadedUrls: string[] = [];

    if (files.length > 0 || keepImages !== undefined) {
      const kept = keepImages ?? [];

      if (files.length + kept.length > MAX_IMAGES) {
        throw new BadRequestException(
          `Maximum ${MAX_IMAGES} images allowed per product`,
        );
      }

      try {
        if (files.length > 0) {
          const s3Urls = await this.storageService.uploadFiles(files, S3_FOLDER);
          uploadedUrls.push(...s3Urls);
          this.logger.log(`Uploaded ${s3Urls.length} new images to S3`);
        }

        imageFinalUrls = [...kept, ...uploadedUrls];
      } catch (error) {
        if (uploadedUrls.length > 0) {
          this.logger.warn(`Rolling back ${uploadedUrls.length} S3 uploads`);
          await Promise.allSettled(
            uploadedUrls.map((url) => this.storageService.deleteFileByUrl(url)),
          );
        }
        throw error;
      }
    }

    // 4. Persistir (atómico: fields + imagen sync en una transacción)
    try {
      const updated = await this.productRepository.update(
        id,
        changes,
        imageFinalUrls,
      );
      this.logger.log(`Product updated: ${id}`);
      return updated;
    } catch (error) {
      // Si la DB falla DESPUÉS de subir a S3, rollback
      if (uploadedUrls.length > 0) {
        this.logger.warn(`DB failed after S3 upload, rolling back S3`);
        await Promise.allSettled(
          uploadedUrls.map((url) => this.storageService.deleteFileByUrl(url)),
        );
      }
      throw error;
    }
  }
}
