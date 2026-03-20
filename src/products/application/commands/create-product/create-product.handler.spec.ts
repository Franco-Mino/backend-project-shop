import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { faker } from '@faker-js/faker';

import { CreateProductHandler } from './create-product.handler';
import { CreateProductCommand } from './create-product.command';
import { ProductCreatedEvent } from '../../../domain/events/product-created.event';
import { Gender } from '../../../domain/enums/gender.enum';
import { ProductSize } from '../../../domain/enums/product-size.enum';
import {
  makeProduct,
  makeMulterFile,
  makeRepositoryMock,
  makeStorageMock,
  makeEventBusMock,
  makeSlugServiceMock,
} from '../../../__tests__/factories/product.factory';

describe('CreateProductHandler', () => {
  let handler: CreateProductHandler;
  let repository: ReturnType<typeof makeRepositoryMock>;
  let storageService: ReturnType<typeof makeStorageMock>;
  let eventBus: ReturnType<typeof makeEventBusMock>;
  let slugService: ReturnType<typeof makeSlugServiceMock>;

  beforeEach(() => {
    repository = makeRepositoryMock();
    storageService = makeStorageMock();
    eventBus = makeEventBusMock();
    slugService = makeSlugServiceMock();

    handler = new CreateProductHandler(
      repository as any,
      storageService as any,
      slugService as any,
      eventBus as unknown as EventBus,
    );

    // Defaults comunes: slug disponible, genera slug predecible
    slugService.generate.mockReturnValue('test_slug');
    repository.existsBySlug.mockResolvedValue(false);
  });

  function makeCommand(overrides: Partial<ConstructorParameters<typeof CreateProductCommand>[0]> = {}) {
    return new CreateProductCommand({
      title: faker.commerce.productName(),
      sizes: [ProductSize.M],
      gender: [Gender.UNISEX],
      price: faker.number.float({ min: 1, max: 999, fractionDigits: 2 }),
      stock: faker.number.int({ min: 0, max: 100 }),
      tags: [faker.lorem.word()],
      files: [],
      images: [],
      createdById: faker.string.uuid(),
      ...overrides,
    });
  }

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it('should create and persist a product without images', async () => {
    const savedProduct = makeProduct({ slug: 'test_slug' });
    repository.create.mockResolvedValue(savedProduct);

    const command = makeCommand();
    const result = await handler.execute(command);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(result).toBe(savedProduct);
  });

  it('should publish ProductCreatedEvent after successful creation', async () => {
    const savedProduct = makeProduct({ slug: 'test_slug' });
    repository.create.mockResolvedValue(savedProduct);

    await handler.execute(makeCommand());

    expect(eventBus.publish).toHaveBeenCalledWith(
      new ProductCreatedEvent(savedProduct.id, savedProduct.title, savedProduct.slug),
    );
  });

  it('should upload files to S3 and include URLs in the product', async () => {
    const files = [makeMulterFile(), makeMulterFile()];
    const s3Urls = [faker.image.url(), faker.image.url()];
    storageService.uploadFiles.mockResolvedValue(s3Urls);

    const savedProduct = makeProduct();
    repository.create.mockResolvedValue(savedProduct);

    await handler.execute(makeCommand({ files }));

    expect(storageService.uploadFiles).toHaveBeenCalledWith(files, 'products');
    // El producto creado en el repositorio debe tener las imágenes de S3
    const productPassedToRepo = repository.create.mock.calls[0][0];
    const urls = productPassedToRepo.images.map((i: any) => i.url);
    expect(urls).toEqual(expect.arrayContaining(s3Urls));
  });

  it('should include url images in the product when provided', async () => {
    const urlImages = [faker.image.url(), faker.image.url()];
    const savedProduct = makeProduct();
    repository.create.mockResolvedValue(savedProduct);

    await handler.execute(makeCommand({ images: urlImages }));

    const productPassedToRepo = repository.create.mock.calls[0][0];
    const urls = productPassedToRepo.images.map((i: any) => i.url);
    expect(urls).toEqual(expect.arrayContaining(urlImages));
  });

  it('should use custom slug if provided in command', async () => {
    slugService.generate.mockReturnValue('custom_slug');
    repository.existsBySlug.mockResolvedValue(false);
    const savedProduct = makeProduct({ slug: 'custom_slug' });
    repository.create.mockResolvedValue(savedProduct);

    await handler.execute(makeCommand({ slug: 'custom_slug' }));

    expect(slugService.generate).toHaveBeenCalledWith('custom_slug');
  });

  // ─── Validación de imágenes ──────────────────────────────────────────────────

  it('should throw BadRequestException when files + urlImages exceed 5', async () => {
    const files = Array.from({ length: 3 }, () => makeMulterFile());
    const images = [faker.image.url(), faker.image.url(), faker.image.url()];

    await expect(handler.execute(makeCommand({ files, images }))).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('should allow exactly 5 images (files + urlImages)', async () => {
    const files = Array.from({ length: 3 }, () => makeMulterFile());
    const images = [faker.image.url(), faker.image.url()];
    const s3Urls = files.map(() => faker.image.url());
    storageService.uploadFiles.mockResolvedValue(s3Urls);
    repository.create.mockResolvedValue(makeProduct());

    await expect(handler.execute(makeCommand({ files, images }))).resolves.not.toThrow();
  });

  // ─── Validación de slug ──────────────────────────────────────────────────────

  it('should throw ConflictException when slug already exists', async () => {
    repository.existsBySlug.mockResolvedValue(true);

    await expect(handler.execute(makeCommand())).rejects.toThrow(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  // ─── Rollback S3 ────────────────────────────────────────────────────────────

  it('should rollback S3 uploads when DB create fails', async () => {
    const files = [makeMulterFile()];
    const s3Url = faker.image.url();
    storageService.uploadFiles.mockResolvedValue([s3Url]);
    repository.create.mockRejectedValue(new Error('DB connection lost'));

    await expect(handler.execute(makeCommand({ files }))).rejects.toThrow('DB connection lost');

    expect(storageService.deleteFileByUrl).toHaveBeenCalledWith(s3Url);
  });

  it('should NOT call deleteFileByUrl when no files were uploaded (DB fails before S3)', async () => {
    repository.create.mockRejectedValue(new Error('DB error'));

    await expect(handler.execute(makeCommand())).rejects.toThrow('DB error');

    expect(storageService.deleteFileByUrl).not.toHaveBeenCalled();
  });

  it('should rollback multiple S3 uploads on DB failure', async () => {
    const files = [makeMulterFile(), makeMulterFile(), makeMulterFile()];
    const s3Urls = [faker.image.url(), faker.image.url(), faker.image.url()];
    storageService.uploadFiles.mockResolvedValue(s3Urls);
    repository.create.mockRejectedValue(new Error('Constraint violation'));

    await expect(handler.execute(makeCommand({ files }))).rejects.toThrow();

    s3Urls.forEach((url) => {
      expect(storageService.deleteFileByUrl).toHaveBeenCalledWith(url);
    });
  });
});
