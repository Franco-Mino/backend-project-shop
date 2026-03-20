/**
 * DOMAIN ENTITY — ProductImage
 *
 * Regla: Esta clase es pura TypeScript. Sin decoradores de NestJS,
 * TypeORM ni ningún framework. El dominio no sabe que existe infraestructura.
 */
export class ProductImage {
  id: string;
  url: string;
  isActive: boolean;

  /**
   * Factory method: única forma canónica de crear una imagen nueva.
   * La reconstitución desde DB la hace el persistence mapper directamente.
   */
  static create(url: string): ProductImage {
    const image = new ProductImage();
    image.url = url;
    image.isActive = true;
    return image;
  }
}
