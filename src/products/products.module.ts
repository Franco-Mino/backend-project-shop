import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { AuthModule } from '../auth/auth.module';

// Domain
import { SlugDomainService } from './domain/services/slug.domain-service';
import { PRODUCT_REPOSITORY_PORT } from './domain/ports/product.repository.port';
import { STORAGE_SERVICE_PORT } from './domain/ports/storage.service.port';

// Application — Commands
import { CreateProductHandler } from './application/commands/create-product/create-product.handler';
import { UpdateProductHandler } from './application/commands/update-product/update-product.handler';
import { DeleteProductHandler } from './application/commands/delete-product/delete-product.handler';

// Application — Queries
import { FindProductHandler } from './application/queries/find-product/find-product.handler';
import { ListProductsHandler } from './application/queries/list-products/list-products.handler';

// Infrastructure — Persistence
import { ProductOrmEntity } from './infrastructure/persistence/entities/product.orm-entity';
import { ProductImageOrmEntity } from './infrastructure/persistence/entities/product-image.orm-entity';
import { TypeOrmProductRepository } from './infrastructure/persistence/repositories/typeorm-product.repository';

// Infrastructure — Storage
import { S3StorageAdapter } from './infrastructure/storage/s3-storage.adapter';

// Infrastructure — HTTP
import { ProductsController } from './infrastructure/http/controllers/products.controller';

/**
 * ProductsModule — Bounded Context de Productos
 *
 * Registra los bindings entre puertos (interfaces) y adaptadores (clases concretas).
 * Este es el único lugar donde TypeOrmProductRepository y S3StorageAdapter
 * son mencionados explícitamente. Todo el resto de la app los conoce
 * como IProductRepository e IStorageService.
 *
 * Patrón: Composition Root — todo el wiring de dependencias ocurre aquí.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([ProductOrmEntity, ProductImageOrmEntity]),
    AuthModule,
  ],
  controllers: [ProductsController],
  providers: [
    // Domain Services
    SlugDomainService,

    // Port → Adapter bindings (Dependency Inversion)
    {
      provide: PRODUCT_REPOSITORY_PORT,
      useClass: TypeOrmProductRepository,
    },
    {
      provide: STORAGE_SERVICE_PORT,
      useClass: S3StorageAdapter,
    },

    // CQRS Command Handlers
    CreateProductHandler,
    UpdateProductHandler,
    DeleteProductHandler,

    // CQRS Query Handlers
    FindProductHandler,
    ListProductsHandler,
  ],
  exports: [
    // Exportamos el port, no el adapter concreto
    PRODUCT_REPOSITORY_PORT,
    CqrsModule,
  ],
})
export class ProductsModule {}
