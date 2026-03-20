import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { ProductsModule } from '../products/products.module';

/**
 * SeedModule importa ProductsModule para tener acceso al CqrsModule
 * (CommandBus) y los handlers registrados que procesan los commands.
 */
@Module({
  imports: [ProductsModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
