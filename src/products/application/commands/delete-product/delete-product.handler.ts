import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { DeleteProductCommand } from './delete-product.command';
import {
  PRODUCT_REPOSITORY_PORT,
  type IProductRepository,
} from '../../../domain/ports/product.repository.port';
import { ProductDeletedEvent } from '../../../domain/events/product-deleted.event';

/**
 * COMMAND HANDLER — DeleteProductHandler
 *
 * Caso de uso "eliminar producto" (soft delete):
 *   1. Verifica existencia
 *   2. Soft delete vía repositorio
 *   3. Publica ProductDeletedEvent
 */
@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler implements ICommandHandler<
  DeleteProductCommand,
  { message: string }
> {
  private readonly logger = new Logger(DeleteProductHandler.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IProductRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: DeleteProductCommand): Promise<{ message: string }> {
    const product = await this.productRepository.findById(command.id);
    if (!product) {
      throw new NotFoundException(`Product with id "${command.id}" not found`);
    }

    await this.productRepository.softDelete(command.id);
    this.eventBus.publish(new ProductDeletedEvent(command.id));
    this.logger.log(`Product soft-deleted: ${command.id}`);

    return { message: 'Product deleted' };
  }
}
