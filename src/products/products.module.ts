import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductRepository } from './repositories/product.repository';
import { SlugService } from './services/slug.service';
import { ProductSlugService } from './services/product-slug.service';
import { Product, ProductImage } from './entities';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductImage]), StorageModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductRepository,
    SlugService,
    ProductSlugService,
  ],
  exports: [ProductsService, ProductRepository, TypeOrmModule],
})
export class ProductsModule {}
