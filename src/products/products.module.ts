import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

import { ProductRepository } from './repositories/product.repository';

import { SlugService } from './services/slug.service';
import { ProductSlugService } from './services/product-slug.service';
import { ProductTransactionService } from './services/product-transaction.service';

import { Product, ProductImage } from './entities';

import { CreateProductHandler } from './commands/handlers/create-product.handler';
import { UpdateProductHandler } from './commands/handlers/update-product.handler';
import { DeleteProductHandler } from './commands/handlers/delete-product.handler';

const CommandHandlers = [
  CreateProductHandler,
  UpdateProductHandler,
  DeleteProductHandler,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage]),
    CqrsModule,
  ],
  controllers: [ProductsController],
  providers: [
    // Services
    ProductsService,
    ProductRepository,
    SlugService,
    ProductSlugService,
    ProductTransactionService,

    // CQRS Command Handlers
    ...CommandHandlers,
  ],
  exports: [
    ProductsService,
    ProductRepository,
  ],
})
export class ProductsModule { }