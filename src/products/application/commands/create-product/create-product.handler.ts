import {
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';

import { CreateProductCommand } from './create-product.command';
import { Product } from '../../../domain/entities/product.entity';
import { ProductImage } from '../../../domain/entities/product-image.entity';
import { SlugDomainService } from '../../../domain/services/slug.domain-service';
import {
  PRODUCT_REPOSITORY_PORT,
  type IProductRepository,
} from '../../../domain/ports/product.repository.port';
import {
  STORAGE_SERVICE_PORT,
  type IStorageService,
} from '../../../domain/ports/storage.service.port';
import { ProductCreatedEvent } from '../../../domain/events/product-created.event';

const MAX_IMAGES = 5;
const S3_FOLDER = 'products';

/**
 * COMMAND HANDLER — CreateProductHandler
 *
 * Orquesta el caso de uso "crear producto":
 *   1. Valida límite de imágenes
 *   2. Genera slug único
 *   3. Sube archivos a S3 (con rollback si algo falla)
 *   4. Crea la entidad de dominio
 *   5. Persiste vía el port IProductRepository
 *   6. Publica el domain event ProductCreatedEvent
 *
 * No sabe nada de TypeORM, S3, HTTP ni NestJS HTTP exceptions (solo usa
 * las que tiene sentido en la capa de aplicación).
 */
@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<
  CreateProductCommand,
  Product
> {
  private readonly logger = new Logger(CreateProductHandler.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IProductRepository,
    @Inject(STORAGE_SERVICE_PORT)
    private readonly storageService: IStorageService,
    private readonly slugService: SlugDomainService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateProductCommand): Promise<Product> {
    const { files = [], images: urlImages = [], ...props } = command;

    if (files.length + urlImages.length > MAX_IMAGES) {
      throw new BadRequestException(
        `Maximum ${MAX_IMAGES} images allowed per product`,
      );
    }

    // 1. Generar slug único
    const baseInput = props.slug || props.title;
    const slug = this.slugService.generate(baseInput);
    const slugExists = await this.productRepository.existsBySlug(slug);
    if (slugExists) {
      throw new ConflictException(
        `Slug "${slug}" already exists. Use a different title or slug.`,
      );
    }

    // 2. Subir archivos a la nube (con rollback si el guardado en DB falla)
    const uploadedUrls: string[] = [];
    try {
      if (files.length > 0) {
        const s3Urls = await this.storageService.uploadFiles(files, S3_FOLDER);
        uploadedUrls.push(...s3Urls);
        this.logger.log(`Uploaded ${s3Urls.length} images to S3`);
      }

      // 3. Crear entidad de dominio (pure, sin framework)
      const product = Product.create({
        id: randomUUID(),
        title: props.title,
        price: props.price ?? 0,
        stock: props.stock ?? 0,
        sizes: props.sizes,
        gender: props.gender,
        slug,
        description: props.description,
        tags: props.tags ?? [],
        images: [...uploadedUrls, ...urlImages].map((url) =>
          ProductImage.create(url),
        ),
        createdById: props.createdById,
      });

      // 4. Persistir (el adapter maneja la transacción internamente)
      const saved = await this.productRepository.create(product);

      // 5. Publicar domain event (otros módulos pueden suscribirse)
      this.eventBus.publish(
        new ProductCreatedEvent(saved.id, saved.title, saved.slug),
      );

      this.logger.log(`Product created: ${saved.id}`);
      return saved;
    } catch (error) {
      // Rollback S3: si la DB falló, borramos los archivos ya subidos
      if (uploadedUrls.length > 0) {
        this.logger.warn(`Rolling back ${uploadedUrls.length} S3 uploads`);
        await Promise.allSettled(
          uploadedUrls.map((url) => this.storageService.deleteFileByUrl(url)),
        );
      }
      throw error;
    }
  }
}
