import { ProductSlugService } from "src/products/services/product-slug.service";
import { CreateProductCommand } from "../create-product.command";
import { ProductTransactionService } from "src/products/services/product-transaction.service";
import { ProductMapper } from "src/products/mappers/product.mapper";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";

@CommandHandler(CreateProductCommand)
export class CreateProductHandler
    implements ICommandHandler<CreateProductCommand> {
    constructor(
        private readonly productSlugService: ProductSlugService,
        private readonly productTransactionService: ProductTransactionService,
    ) { }

    async execute(command: CreateProductCommand) {
        const { dto } = command;
        const { images = [], ...productDetails } = dto;

        const slug = await this.productSlugService.generateUnique(
            dto.slug || dto.title,
        );

        const productData = ProductMapper.dtoToEntity({
            ...productDetails,
            slug,
        });

        return this.productTransactionService.createWithImages(
            productData,
            images,
        );
    }
}