import { NotFoundException } from '@nestjs/common';
import { faker } from '@faker-js/faker';

import { FindProductHandler } from './find-product.handler';
import { FindProductQuery } from './find-product.query';
import {
  makeProduct,
  makeRepositoryMock,
} from '../../../__tests__/factories/product.factory';

describe('FindProductHandler', () => {
  let handler: FindProductHandler;
  let repository: ReturnType<typeof makeRepositoryMock>;

  beforeEach(() => {
    repository = makeRepositoryMock();
    handler = new FindProductHandler(repository as any);
  });

  it('should return the product when found by UUID', async () => {
    const product = makeProduct();
    repository.findByTerm.mockResolvedValue(product);

    const result = await handler.execute(new FindProductQuery(product.id));

    expect(repository.findByTerm).toHaveBeenCalledWith(product.id);
    expect(result).toBe(product);
  });

  it('should return the product when found by slug', async () => {
    const product = makeProduct();
    repository.findByTerm.mockResolvedValue(product);

    const result = await handler.execute(new FindProductQuery(product.slug));

    expect(repository.findByTerm).toHaveBeenCalledWith(product.slug);
    expect(result).toBe(product);
  });

  it('should throw NotFoundException when product is not found', async () => {
    repository.findByTerm.mockResolvedValue(null);
    const term = faker.string.uuid();

    await expect(handler.execute(new FindProductQuery(term))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should include the term in the NotFoundException message', async () => {
    repository.findByTerm.mockResolvedValue(null);
    const term = 'non_existent_product';

    await expect(handler.execute(new FindProductQuery(term))).rejects.toThrow(
      term,
    );
  });
});
