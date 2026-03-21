import { NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { faker } from '@faker-js/faker';

import { DeleteProductHandler } from './delete-product.handler';
import { DeleteProductCommand } from './delete-product.command';
import { ProductDeletedEvent } from '../../../domain/events/product-deleted.event';
import {
  makeProduct,
  makeRepositoryMock,
  makeEventBusMock,
} from '../../../__tests__/factories/product.factory';

describe('DeleteProductHandler', () => {
  let handler: DeleteProductHandler;
  let repository: ReturnType<typeof makeRepositoryMock>;
  let eventBus: ReturnType<typeof makeEventBusMock>;

  beforeEach(() => {
    repository = makeRepositoryMock();
    eventBus = makeEventBusMock();

    handler = new DeleteProductHandler(
      repository as any,
      eventBus as unknown as EventBus,
    );
  });

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it('should soft-delete the product and return a message', async () => {
    const product = makeProduct();
    repository.findById.mockResolvedValue(product);
    repository.softDelete.mockResolvedValue(undefined);

    const result = await handler.execute(new DeleteProductCommand(product.id));

    expect(repository.softDelete).toHaveBeenCalledWith(product.id);
    expect(result).toEqual({ message: 'Product deleted' });
  });

  it('should publish ProductDeletedEvent after soft-delete', async () => {
    const product = makeProduct();
    repository.findById.mockResolvedValue(product);
    repository.softDelete.mockResolvedValue(undefined);

    await handler.execute(new DeleteProductCommand(product.id));

    expect(eventBus.publish).toHaveBeenCalledWith(
      new ProductDeletedEvent(product.id),
    );
  });

  it('should look up the product by the provided id', async () => {
    const product = makeProduct();
    repository.findById.mockResolvedValue(product);
    repository.softDelete.mockResolvedValue(undefined);

    await handler.execute(new DeleteProductCommand(product.id));

    expect(repository.findById).toHaveBeenCalledWith(product.id);
  });

  // ─── Errores ─────────────────────────────────────────────────────────────────

  it('should throw NotFoundException when product does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    const id = faker.string.uuid();

    await expect(handler.execute(new DeleteProductCommand(id))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should NOT call softDelete when product is not found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteProductCommand(faker.string.uuid())),
    ).rejects.toThrow();

    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('should NOT publish event when product is not found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteProductCommand(faker.string.uuid())),
    ).rejects.toThrow();

    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
