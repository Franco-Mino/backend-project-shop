import { faker } from '@faker-js/faker';
import { Product } from '../../domain/entities/product.entity';
import { ProductImage } from '../../domain/entities/product-image.entity';
import { Gender } from '../../domain/enums/gender.enum';
import { ProductSize } from '../../domain/enums/product-size.enum';
import { IProductRepository } from '../../domain/ports/product.repository.port';
import { IStorageService } from '../../domain/ports/storage.service.port';

// ─── Product ────────────────────────────────────────────────────────────────

export function makeProduct(
  overrides: Partial<Parameters<typeof Product.create>[0]> = {},
): Product {
  return Product.create({
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    price: faker.number.float({ min: 1, max: 999, fractionDigits: 2 }),
    stock: faker.number.int({ min: 0, max: 100 }),
    sizes: [ProductSize.M, ProductSize.L],
    gender: [Gender.UNISEX],
    slug:
      faker.string.alpha(5).toLowerCase() +
      '_' +
      faker.string.alpha(4).toLowerCase(),
    description: faker.lorem.sentence(),
    tags: [faker.lorem.word(), faker.lorem.word()],
    images: [],
    createdById: faker.string.uuid(),
    ...overrides,
  });
}

export function makeProductImage(url?: string): ProductImage {
  return ProductImage.create(url ?? faker.image.url());
}

export function makeMulterFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname: faker.system.fileName({ extensionCount: 1 }) + '.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from(faker.string.alphanumeric(100)),
    size: faker.number.int({ min: 1000, max: 500000 }),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

// ─── Mocks ──────────────────────────────────────────────────────────────────

export function makeRepositoryMock(): jest.Mocked<IProductRepository> {
  return {
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn(),
    findByTerm: jest.fn(),
    findAll: jest.fn(),
    existsBySlug: jest.fn(),
  };
}

export function makeStorageMock(): jest.Mocked<IStorageService> {
  return {
    uploadFiles: jest.fn(),
    deleteFileByUrl: jest.fn(),
  };
}

export function makeEventBusMock() {
  return { publish: jest.fn() };
}

export function makeSlugServiceMock() {
  return { generate: jest.fn(), isValid: jest.fn() };
}
