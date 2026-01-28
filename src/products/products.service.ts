import { ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductMapper } from './mappers/product.mapper';
import { QueryFailedError } from 'typeorm';
import { ProductSlugService } from './services/product-slug.service';
import { ProductRepository } from './repositories/product.repository';
import { PaginationDto } from '../common/pagination/dto/pagination.dto';
import { isUUID } from 'class-validator';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService');

  constructor(

    private readonly productRepository: ProductRepository,
    private readonly productSlugService: ProductSlugService,
  ) { }

  async create(createProductDto: CreateProductDto) {
    try {
      const slug = await this.productSlugService.generateUnique(
        createProductDto.slug || createProductDto.title
      );

      const productData = ProductMapper.dtoToEntity({
        ...createProductDto,
        slug,
      });

      const product = this.productRepository.create(productData);
      await this.productRepository.save(product);

      this.logger.log(`Product created: ${product.id}`);
      return product;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  /**
   * Listar solo productos activos
   */
  async findAll(paginationDto: PaginationDto) {
    try {
      const { limit, offset } = paginationDto;
      const date = await this.productRepository.findActive({
        take: limit,
        skip: offset,
      });
      return date
    } catch (error) {
      this.logger.error('Error fetching products:', error);
      return this.handleDBExceptions(error);
    }
  }

  async findOne(term: string): Promise<Product> {
    try {
      const queryCondition = isUUID(term)
        ? { id: term, isActive: true }
        : { slug: term, isActive: true };

      const product = await this.productRepository.findOneBy(queryCondition);

      if (!product) {
        throw new NotFoundException(`Product with term '${term}' not found`);
      }

      return product;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error finding product ${term}:`, error);
      throw new InternalServerErrorException('Error finding product');
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    try {
      const product = await this.findOne(id); // Validar que existe y está activo

      let productData = ProductMapper.dtoToEntity(updateProductDto);

      // Si cambia el title, regenerar el slug automáticamente
      if (updateProductDto.title && updateProductDto.title !== product.title) {
        // Generar nuevo slug basado en el nuevo title
        const newSlug = await this.productSlugService.generateUnique(
          updateProductDto.title,
          id // Excluir el producto actual para evitar conflicto consigo mismo
        );
        productData.slug = newSlug;
      }
      // Si envía slug explícitamente, validar que no exista (excepto el actual)
      else if (updateProductDto.slug && updateProductDto.slug !== product.slug) {
        const slugExists = await this.productSlugService.exists(
          updateProductDto.slug,
          id
        );
        if (slugExists) {
          throw new ConflictException(`Slug "${updateProductDto.slug}" already exists`);
        }
      }

      await this.productRepository.update(id, productData);
      return this.findOne(id);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.logger.error(`Error updating product ${id}:`, error);
      return this.handleDBExceptions(error);
    }
  }

  /**
   * Soft delete: marca como inactivo (recuperable)
   */
  async remove(id: string) {
    try {
      await this.findOne(id); // Validar que existe
      await this.productRepository.softDelete(id);
      return { message: 'Product deleted' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error deleting product ${id}:`, error);
      return this.handleDBExceptions(error);
    }
  }

  private handleDBExceptions(error: unknown): never {
    if (error instanceof ConflictException ||
      error instanceof InternalServerErrorException ||
      error instanceof NotFoundException) {
      throw error;
    }

    if (error instanceof QueryFailedError) {
      if ((error as any).code === '23505') {
        this.logger.warn(`Duplicate key: ${(error as any).detail}`);
        throw new ConflictException((error as any).detail);
      }

      this.logger.error(`DB Error: ${error.message}`);
      throw new InternalServerErrorException('Database operation failed');
    }

    this.logger.error('Unexpected error:', error);
    throw new InternalServerErrorException('An unexpected error occurred');
  }
}
