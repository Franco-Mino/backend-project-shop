import { faker } from '@faker-js/faker';
import { Product, CreateProductProps } from './product.entity';
import { ProductImage } from './product-image.entity';
import { Gender } from '../enums/gender.enum';
import { ProductSize } from '../enums/product-size.enum';

function makeProps(overrides: Partial<CreateProductProps> = {}): CreateProductProps {
  return {
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    price: faker.number.float({ min: 1, max: 999, fractionDigits: 2 }),
    stock: faker.number.int({ min: 1, max: 100 }),
    sizes: [ProductSize.M],
    gender: [Gender.UNISEX],
    slug: 'test_slug',
    ...overrides,
  };
}

describe('Product entity', () => {

  // ─── Product.create() ───────────────────────────────────────────────────────

  describe('create()', () => {
    it('should assign all provided props', () => {
      const props = makeProps({
        description: faker.lorem.sentence(),
        tags: ['sale', 'new'],
      });
      const product = Product.create(props);

      expect(product.id).toBe(props.id);
      expect(product.title).toBe(props.title);
      expect(product.price).toBe(props.price);
      expect(product.stock).toBe(props.stock);
      expect(product.sizes).toEqual(props.sizes);
      expect(product.gender).toEqual(props.gender);
      expect(product.slug).toBe(props.slug);
      expect(product.description).toBe(props.description);
      expect(product.tags).toEqual(props.tags);
    });

    it('should set isActive to true by default', () => {
      const product = Product.create(makeProps());
      expect(product.isActive).toBe(true);
    });

    it('should default price to 0 when not provided', () => {
      const product = Product.create(makeProps({ price: undefined }));
      expect(product.price).toBe(0);
    });

    it('should default stock to 0 when not provided', () => {
      const product = Product.create(makeProps({ stock: undefined }));
      expect(product.stock).toBe(0);
    });

    it('should default tags to [] when not provided', () => {
      const product = Product.create(makeProps({ tags: undefined }));
      expect(product.tags).toEqual([]);
    });

    it('should default images to [] when not provided', () => {
      const product = Product.create(makeProps({ images: undefined }));
      expect(product.images).toEqual([]);
    });

    it('should assign provided images', () => {
      const images = [ProductImage.create(faker.image.url()), ProductImage.create(faker.image.url())];
      const product = Product.create(makeProps({ images }));
      expect(product.images).toHaveLength(2);
      expect(product.images[0].url).toBe(images[0].url);
    });

    it('should assign createdById when provided', () => {
      const createdById = faker.string.uuid();
      const product = Product.create(makeProps({ createdById }));
      expect(product.createdById).toBe(createdById);
    });

    it('should create independent instances with random faker data', () => {
      const p1 = Product.create(makeProps());
      const p2 = Product.create(makeProps());
      expect(p1.id).not.toBe(p2.id);
    });
  });

  // ─── deactivate() ───────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('should set isActive to false', () => {
      const product = Product.create(makeProps());
      expect(product.isActive).toBe(true);

      product.deactivate();
      expect(product.isActive).toBe(false);
    });
  });

  // ─── isEditable() ───────────────────────────────────────────────────────────

  describe('isEditable()', () => {
    it('should return true when product is active', () => {
      const product = Product.create(makeProps());
      expect(product.isEditable()).toBe(true);
    });

    it('should return false after product is deactivated', () => {
      const product = Product.create(makeProps());
      product.deactivate();
      expect(product.isEditable()).toBe(false);
    });
  });
});

// ─── ProductImage.create() ──────────────────────────────────────────────────

describe('ProductImage entity', () => {
  it('should create an image with the provided url', () => {
    const url = faker.image.url();
    const image = ProductImage.create(url);
    expect(image.url).toBe(url);
  });

  it('should set isActive to true by default', () => {
    const image = ProductImage.create(faker.image.url());
    expect(image.isActive).toBe(true);
  });

  it('should create independent instances', () => {
    const img1 = ProductImage.create(faker.image.url());
    const img2 = ProductImage.create(faker.image.url());
    expect(img1.url).not.toBe(img2.url);
  });
});
