/**
 * COMMAND — DeleteProductCommand
 *
 * Representa la intención de hacer un soft delete de un producto.
 */
export class DeleteProductCommand {
  constructor(public readonly id: string) {}
}
