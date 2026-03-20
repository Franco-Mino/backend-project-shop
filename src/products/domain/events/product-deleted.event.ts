/**
 * DOMAIN EVENT — ProductDeletedEvent
 *
 * Se publica cuando un producto es desactivado (soft delete).
 */
export class ProductDeletedEvent {
  constructor(public readonly productId: string) {}
}
