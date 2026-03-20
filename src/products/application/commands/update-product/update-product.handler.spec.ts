import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { faker } from '@faker-js/faker';

import { UpdateProductHandler } from './update-product.handler';
import { UpdateProductCommand } from './update-product.command';
import { Gender } from '../../../domain/enums/gender.enum';
import { ProductSize } from '../../../domain/enums/product-size.enum';
import {
  makeProduct,
  makeMulterFile,
  makeRepositoryMock,
  makeStorageMock,
  makeSlugServiceMock,
} from '../../../__tests__/factories/product.factory';

describe('UpdateProductHandler', () => {
  let handler: UpdateProductHandler;
  let repository: ReturnType<typeof makeRepositoryMock>;
  let storageService: ReturnType<typeof makeStorageMock>;
  let slugService: ReturnType<typeof makeSlugServiceMock>;

  beforeEach(() => {
    repository = makeRepositoryMock();
    storageService = makeStorageMock();
    slugService = makeSlugServiceMock();

    handler = new UpdateProductHandler(
      repository as any,
      storageService as any,
      slugService as any,
    );

    slugService.generate.mockReturnValue('generated_slug');
    repository.existsBySlug.mockResolvedValue(false);
  });

  function makeCommand(
    overrides: Partial<ConstructorParameters<typeof UpdateProductCommand>[0]> = {},
  ) {
    return new UpdateProductCommand({
      id: faker.string.uuid(),
      ...overrides,
    });
  }

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it('should update product fields and return the updated product', async () => {
    const existing = makeProduct();
    const updated = makeProduct({ id: existing.id, title: 'New Title' });
    repository.findById.mockResolvedValue(existing);
    repository.update.mockResolvedValue(updated);

    const result = await handler.execute(makeCommand({ id: existing.id, title: 'New Title' }));

    expect(repository.update).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ title: 'New Title' }),
      undefined,
    );
    expect(result).toBe(updated);
  });

  it('should update multiple fields at once', async () => {
    const existing = makeProduct();
    const updated = makeProduct({ id: existing.id });
    repository.findById.mockResolvedValue(existing);
    repository.update.mockResolvedValue(updated);

    const newPrice = faker.number.float({ min: 1, max: 999, fractionDigits: 2 });
    const newStock = faker.number.int({ min: 0, max: 200 });

    await handler.execute(makeCommand({
      id: existing.id,
      price: newPrice,
      stock: newStock,
      sizes: [ProductSize.XL],
      gender: [Gender.WOMEN],
    }));

    expect(repository.update).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({
        price: newPrice,
        stock: newStock,
        sizes: [ProductSize.XL],
        gender: [Gender.WOMEN],
      }),
      undefined,
    );
  });

  it('should regenerate slug when title changes and no custom slug provided', async () => {
    const existing = makeProduct({ slug: 'old_slug' });
    slugService.generate.mockReturnValue('new_title_slug');
    repository.findById.mockResolvedValue(existing);
    repository.update.mockResolvedValue(makeProduct());

    await handler.execute(makeCommand({ id: existing.id, title: 'New Title' }));

    expect(slugService.generate).toHaveBeenCalledWith('New Title');
    const changes = repository.update.mock.calls[0][1];
    expect(changes.slug).toBe('new_title_slug');
  });

  it('should use custom slug when explicitly provided and different from existing', async () => {
    const existing = makeProduct({ slug: 'old_slug' });
    slugService.generate.mockReturnValue('custom_new_slug');
    repository.findById.mockResolvedValue(existing);
    repository.update.mockResolvedValue(makeProduct());

    await handler.execute(makeCommand({ id: existing.id, slug: 'custom_new_slug' }));

    expect(slugService.generate).toHaveBeenCalledWith('custom_new_slug');
  });

  it('should NOT regenerate slug when title is same as existing', async () => {
    const existing = makeProduct({ title: 'Same Title', slug: 'same_title' });
    repository.findById.mockResolvedValue(existing);
    repository.update.mockResolvedValue(makeProduct());

    await handler.execute(makeCommand({ id: existing.id, title: 'Same Title' }));

    // slugService.generate debería no llamarse para el mismo título,
    // o si se llama, no debería setear changes.slug.
    // El handler actualiza slug solo si el título cambió (title !== existing.title)
    const changes = repository.update.mock.calls[0][1];
    expect(changes.slug).toBeUndefined();
  });

  // ─── Manejo de imágenes ──────────────────────────────────────────────────────

  it('should upload new files and merge with keepImages', async () => {
    const existing = makeProduct();
    repository.findById.mockResolvedValue(existing);

    const keptUrl = faker.image.url();
    const newFile = makeMulterFile();
    const s3Url = faker.image.url();
    storageService.uploadFiles.mockResolvedValue([s3Url]);
    repository.update.mockResolvedValue(makeProduct());

    await handler.execute(makeCommand({
      id: existing.id,
      files: [newFile],
      keepImages: [keptUrl],
    }));

    expect(storageService.uploadFiles).toHaveBeenCalledWith([newFile], 'products');
    const imageFinalUrls = repository.update.mock.calls[0][2];
    expect(imageFinalUrls).toEqual(expect.arrayContaining([keptUrl, s3Url]));
  });

  it('should set imageFinalUrls to keepImages only when no new files', async () => {
    const existing = makeProduct();
    repository.findById.mockResolvedValue(existing);
    const keptUrls = [faker.image.url()];
    repository.update.mockResolvedValue(makeProduct());

    await handler.execute(makeCommand({ id: existing.id, keepImages: keptUrls }));

    const imageFinalUrls = repository.update.mock.calls[0][2];
    expect(imageFinalUrls).toEqual(keptUrls);
    expect(storageService.uploadFiles).not.toHaveBeenCalled();
  });

  it('should pass undefined imageFinalUrls when no image fields provided', async () => {
    const existing = makeProduct();
    repository.findById.mockResolvedValue(existing);
    repository.update.mockResolvedValue(makeProduct());

    await handler.execute(makeCommand({ id: existing.id, title: 'Only Title Change' }));

    const imageFinalUrls = repository.update.mock.calls[0][2];
    expect(imageFinalUrls).toBeUndefined();
  });

  // ─── Errores ─────────────────────────────────────────────────────────────────

  it('should throw NotFoundException when product does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    const id = faker.string.uuid();

    await expect(handler.execute(makeCommand({ id }))).rejects.toThrow(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when new slug already exists', async () => {
    const existing = makeProduct({ slug: 'old_slug' });
    slugService.generate.mockReturnValue('taken_slug');
    repository.findById.mockResolvedValue(existing);
    repository.existsBySlug.mockResolvedValue(true);

    await expect(
      handler.execute(makeCommand({ id: existing.id, slug: 'taken_slug' })),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException when files + keepImages exceed 5', async () => {
    const existing = makeProduct();
    repository.findById.mockResolvedValue(existing);

    const files = Array.from({ length: 3 }, () => makeMulterFile());
    const keepImages = [faker.image.url(), faker.image.url(), faker.image.url()];

    await expect(
      handler.execute(makeCommand({ id: existing.id, files, keepImages })),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.uploadFiles).not.toHaveBeenCalled();
  });

  // ─── Rollback S3 ────────────────────────────────────────────────────────────

  it('should rollback S3 uploads when DB update fails after upload', async () => {
    const existing = makeProduct();
    repository.findById.mockResolvedValue(existing);

    const files = [makeMulterFile()];
    const s3Url = faker.image.url();
    storageService.uploadFiles.mockResolvedValue([s3Url]);
    repository.update.mockRejectedValue(new Error('DB failure'));

    await expect(handler.execute(makeCommand({ id: existing.id, files }))).rejects.toThrow(
      'DB failure',
    );

    expect(storageService.deleteFileByUrl).toHaveBeenCalledWith(s3Url);
  });
});
