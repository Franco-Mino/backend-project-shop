import { faker } from '@faker-js/faker';

import { ListProductsHandler } from './list-products.handler';
import { ListProductsQuery } from './list-products.query';
import {
  makeProduct,
  makeRepositoryMock,
} from '../../../__tests__/factories/product.factory';

describe('ListProductsHandler', () => {
  let handler: ListProductsHandler;
  let repository: ReturnType<typeof makeRepositoryMock>;

  beforeEach(() => {
    repository = makeRepositoryMock();
    handler = new ListProductsHandler(repository as any);
  });

  it('should return a paginated list of products', async () => {
    const products = Array.from({ length: 5 }, () => makeProduct());
    repository.findAll.mockResolvedValue(products);

    const result = await handler.execute(new ListProductsQuery(10, 0));

    expect(result).toHaveLength(5);
    expect(result).toBe(products);
  });

  it('should pass limit and offset to the repository', async () => {
    const limit = faker.number.int({ min: 1, max: 50 });
    const offset = faker.number.int({ min: 0, max: 100 });
    repository.findAll.mockResolvedValue([]);

    await handler.execute(new ListProductsQuery(limit, offset));

    expect(repository.findAll).toHaveBeenCalledWith({ limit, offset });
  });

  it('should return an empty array when no products exist', async () => {
    repository.findAll.mockResolvedValue([]);

    const result = await handler.execute(new ListProductsQuery(10, 0));

    expect(result).toEqual([]);
  });

  it('should return all products on the requested page', async () => {
    const page1 = Array.from({ length: 10 }, () => makeProduct());
    repository.findAll.mockResolvedValue(page1);

    const result = await handler.execute(new ListProductsQuery(10, 0));

    expect(result).toHaveLength(10);
  });

  it('should handle large offsets gracefully', async () => {
    repository.findAll.mockResolvedValue([]);

    const result = await handler.execute(new ListProductsQuery(10, 99999));

    expect(result).toEqual([]);
    expect(repository.findAll).toHaveBeenCalledWith({
      limit: 10,
      offset: 99999,
    });
  });
});
