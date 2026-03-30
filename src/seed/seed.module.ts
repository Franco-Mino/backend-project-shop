import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { ProductsModule } from '../products/products.module';
import { AuthModule } from '../auth/auth.module';

/**
 * SeedModule importa ProductsModule para tener acceso al CqrsModule
 * (CommandBus) y los handlers registrados que procesan los commands.
 * Importa AuthModule para poder usar JwtAuthGuard y RolesGuard.
 */
@Module({
  imports: [ProductsModule, AuthModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
