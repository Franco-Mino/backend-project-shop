import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { DeleteProductCommand } from "../delete-product.command";
import { ProductRepository } from "src/products/repositories/product.repository";
import { NotFoundException } from "@nestjs/common";

@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler
  implements ICommandHandler<DeleteProductCommand> {
  constructor(
    private readonly productRepository: ProductRepository,
  ) { }

  async execute(command: DeleteProductCommand) {
    const { id } = command;

    const product = await this.productRepository.findOneBy({
      id,
      isActive: true,
    });

    if (!product) {
      throw new NotFoundException(`Product not found`);
    }

    await this.productRepository.softDelete(id);

    return { message: 'Product deleted' };
  }
}