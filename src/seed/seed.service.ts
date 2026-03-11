import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CreateProductCommand } from '../products/commands/create-product.command';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { ProductSize } from '../products/enums/product-size.enum';
import { Gender } from '../products/enums/gender.enum';
import { initialData, SeedProduct } from './data/seed-data';

@Injectable()
export class SeedService {
  constructor(
    private readonly commandBus: CommandBus,
  ) { }

  async runSeed() {
    await this.insertProducts();
    return 'Seed executed';
  }

  private async insertProducts() {
    const products = initialData.products;

    const insertPromises = products.map((seedProduct) =>
      this.commandBus.execute(
        new CreateProductCommand(this.mapSeedProductToDto(seedProduct)),
      ),
    );

    await Promise.all(insertPromises);
  }

  private mapSeedProductToDto(seedProduct: SeedProduct): CreateProductDto {
    return {
      title: seedProduct.title,
      description: seedProduct.description,
      price: seedProduct.price,
      stock: seedProduct.stock,
      slug: seedProduct.slug,
      sizes: seedProduct.sizes.map((size) => size as ProductSize),
      gender: seedProduct.gender.map((gender) => gender as Gender),
      tags: seedProduct.tags,
      images: seedProduct.images,
    };
  }
}