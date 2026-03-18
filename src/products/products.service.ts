import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { ProductRepository } from './repositories/product.repository';
import { ProductSlugService } from './services/product-slug.service';
import { SlugService } from './services/slug.service';
import { ProductMapper } from './mappers/product.mapper';
import { Product } from './entities';
import { ProductImage } from './entities/product-image.entity';

import { PaginationDto } from '../common/pagination/dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/response-product.dto';
import { S3StorageService } from '../common/storage/s3-storage-service';

const MAX_IMAGES = 5;
const S3_FOLDER = 'products';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly productSlugService: ProductSlugService,
    private readonly slugService: SlugService,
    private readonly dataSource: DataSource,
    private readonly s3StorageService: S3StorageService,
  ) {}

  async create(
    dto: CreateProductDto,
    files: Express.Multer.File[] = [],
  ): Promise<ProductResponseDto> {
    const { images: urlImages = [], ...productDetails } = dto;

    // Support both file uploads and direct URL arrays (e.g. seed service)
    const totalImages = files.length + urlImages.length;
    if (totalImages > MAX_IMAGES) {
      throw new BadRequestException(
        `Maximum ${MAX_IMAGES} images allowed per product`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uploadedUrls: string[] = [];

    try {
      if (files.length > 0) {
        const s3Urls = await this.s3StorageService.uploadFiles(
          files,
          S3_FOLDER,
        );
        uploadedUrls.push(...s3Urls);
      }

      const images = [...uploadedUrls, ...urlImages];

      const slug = await this.productSlugService.generateUnique(
        dto.slug || dto.title,
        undefined,
        queryRunner.manager,
      );

      const productData = ProductMapper.dtoToEntity({ ...productDetails, slug });

      const product = queryRunner.manager.create(Product, {
        ...productData,
        images: images.map((url) =>
          queryRunner.manager.create(ProductImage, { url }),
        ),
      });

      const saved = await queryRunner.manager.save(Product, product);
      await queryRunner.commitTransaction();

      const created = await this.productRepository.findOneActiveBy(saved.id);
      return ProductMapper.toResponse(created!);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await Promise.allSettled(
        uploadedUrls.map((url) => this.s3StorageService.deleteFileByUrl(url)),
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(paginationDto: PaginationDto): Promise<ProductResponseDto[]> {
    const products = await this.productRepository.findActive(paginationDto);
    return ProductMapper.toResponseMany(products);
  }

  async findOne(term: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOneActiveBy(term);
    if (!product) {
      throw new NotFoundException(`Product with term '${term}' not found`);
    }
    return ProductMapper.toResponse(product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    files: Express.Multer.File[] = [],
  ): Promise<ProductResponseDto> {
    const { keepImages = [], ...updateDetails } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uploadedUrls: string[] = [];

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id, isActive: true },
      });

      if (!product) {
        throw new NotFoundException(`Product with id ${id} not found`);
      }

      const productData = ProductMapper.dtoToEntity(updateDetails);

      if (
        updateDetails.title &&
        updateDetails.title !== product.title &&
        !productData.slug
      ) {
        productData.slug = await this.productSlugService.generateUnique(
          updateDetails.title,
          id,
          queryRunner.manager,
        );
      } else if (updateDetails.slug && updateDetails.slug !== product.slug) {
        const normalizedSlug = this.slugService.generate(updateDetails.slug);
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

      await queryRunner.manager.update(Product, id, productData);

      // If files or keepImages are provided, sync images
      if (files.length > 0 || dto.keepImages !== undefined) {
        if (files.length > 0) {
          const s3Urls = await this.s3StorageService.uploadFiles(
            files,
            S3_FOLDER,
          );
          uploadedUrls.push(...s3Urls);
        }

        const finalImages = [...keepImages, ...uploadedUrls];

        if (finalImages.length > MAX_IMAGES) {
          throw new BadRequestException(
            `Maximum ${MAX_IMAGES} images allowed per product`,
          );
        }

        await this.syncImages(id, finalImages, queryRunner.manager);
      }

      await queryRunner.commitTransaction();

      const updated = await this.productRepository.findOneActiveBy(id);
      if (!updated) {
        throw new NotFoundException(
          `Product with id ${id} not found after update`,
        );
      }

      return ProductMapper.toResponse(updated);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await Promise.allSettled(
        uploadedUrls.map((url) => this.s3StorageService.deleteFileByUrl(url)),
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const product = await this.productRepository.findOneBy({
      id,
      isActive: true,
    });
    if (!product) {
      throw new NotFoundException(`Product not found`);
    }
    await this.productRepository.update(id, { isActive: false });
    return { message: 'Product deleted' };
  }

  private async syncImages(
    productId: string,
    incomingUrls: string[],
    manager: EntityManager,
  ): Promise<void> {
    const currentImages = await manager.find(ProductImage, {
      where: { product: { id: productId }, isActive: true },
    });

    const currentUrlSet = new Set(currentImages.map((img) => img.url));
    const incomingUrlSet = new Set(incomingUrls);

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

    const urlsToCreate = incomingUrls.filter((url) => !currentUrlSet.has(url));

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
