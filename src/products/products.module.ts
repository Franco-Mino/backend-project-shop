import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductRepository } from './repositories/product.repository';
import { SlugService } from './services/slug.service';
import { ProductSlugService } from './services/product-slug.service';

import { Product, ProductImage } from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage])
  ],
  controllers: [ProductsController],
  providers: [ProductRepository, ProductsService, SlugService, ProductSlugService],
  exports: [ProductsService, ProductRepository],
})
export class ProductsModule { }
