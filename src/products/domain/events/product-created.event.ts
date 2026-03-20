/**
 * DOMAIN EVENT — ProductCreatedEvent
 *
 * Se publica después de que un producto se crea exitosamente.
 * Otros módulos (audit, notificaciones, inventory) pueden suscribirse
 * sin que el módulo de products los conozca directamente.
 */
export class ProductCreatedEvent {
  constructor(
    public readonly productId: string,
    public readonly title: string,
    public readonly slug: string,
  ) {}
}
