import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { CreateProductCommand } from '../products/application/commands/create-product/create-product.command';
import { ProductSize } from '../products/domain/enums/product-size.enum';
import { Gender } from '../products/domain/enums/gender.enum';
import { initialData, SeedProduct } from './data/seed-data';

/**
 * SEED SERVICE
 *
 * Usa CommandBus para reutilizar exactamente el mismo caso de uso
 * que el endpoint HTTP — misma validación, mismo slug, mismo S3 rollback.
 *
 * El seed pasa URLs directas en `images` (no archivos), que el handler
 * acepta para compatibilidad con datos de prueba.
 */
@Injectable()
export class SeedService {
  constructor(private readonly commandBus: CommandBus) {}

  async runSeed(): Promise<string> {
    await this.insertProducts();
    return 'Seed executed';
  }

  private async insertProducts(): Promise<void> {
    for (const seedProduct of initialData.products) {
      await this.commandBus.execute(this.toCommand(seedProduct));
    }
  }

  private toCommand(seedProduct: SeedProduct): CreateProductCommand {
    return new CreateProductCommand({
      title: seedProduct.title,
      description: seedProduct.description,
      price: seedProduct.price,
      stock: seedProduct.stock,
      slug: seedProduct.slug,
      sizes: seedProduct.sizes.map((s) => s as ProductSize),
      gender: seedProduct.gender.map((g) => g as Gender),
      tags: seedProduct.tags,
      images: seedProduct.images,
    });
  }
}
