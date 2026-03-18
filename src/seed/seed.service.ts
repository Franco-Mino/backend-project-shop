import { Injectable } from '@nestjs/common';

import { ProductsService } from '../products/products.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { ProductSize } from '../products/enums/product-size.enum';
import { Gender } from '../products/enums/gender.enum';
import { initialData, SeedProduct } from './data/seed-data';

@Injectable()
export class SeedService {
  constructor(private readonly productsService: ProductsService) {}

  async runSeed() {
    await this.insertProducts();
    return 'Seed executed';
  }

  private async insertProducts() {
    const insertPromises = initialData.products.map((seedProduct) =>
      this.productsService.create(this.mapSeedProductToDto(seedProduct)),
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
