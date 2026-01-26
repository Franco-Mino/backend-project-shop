import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductMapper } from './mappers/product.mapper';
import { QueryFailedError, Repository } from 'typeorm';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService');


  constructor(

    // Patron repository
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

  ) { }


  async create(createProductDto: CreateProductDto) {
    try {
      console.log(createProductDto, "createProductDto");
      const productData = ProductMapper.dtoToEntity(createProductDto);
      console.log(productData);
      const product = this.productRepository.create(productData);
      await this.productRepository.save(product);
      return product;

    } catch (error) {
      this.handleDBExceptions(error);
    }

  }

  findAll() {
    return `This action returns all products`;
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }


  private handleDBExceptions(error: unknown): never {
    // Guard: es un objeto con propiedades?
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as Record<string, unknown>;

      if (dbError.code === '23505') {
        this.logger.warn(`Duplicate key violation: ${dbError.detail}`);
        throw new BadRequestException(`${dbError.detail}`);
      }
    }

    // Fallback
    this.logger.error('Database error:', error);
    throw new InternalServerErrorException('Could not process request');
  }
}

