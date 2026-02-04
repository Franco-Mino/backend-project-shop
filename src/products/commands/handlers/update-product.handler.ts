import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { UpdateProductCommand } from "../update-product.command";
import { ProductRepository } from "src/products/repositories/product.repository";
import { SlugService } from "src/products/services/slug.service";
import { ProductSlugService } from "src/products/services/product-slug.service";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ProductMapper } from "src/products/mappers/product.mapper";

@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler
    implements ICommandHandler<UpdateProductCommand> {
    constructor(
        private readonly productRepository: ProductRepository,
        private readonly productSlugService: ProductSlugService,
        private readonly slugService: SlugService,
    ) { }

    async execute(command: UpdateProductCommand) {
        const { id, dto } = command;

        const product = await this.productRepository.findOneBy({
            id,
            isActive: true,
        });

        if (!product) {
            throw new NotFoundException(`Product with id ${id} not found`);
        }

        let productData = ProductMapper.dtoToEntity(dto);

        if (dto.title && dto.title !== product.title && !productData.slug) {
            productData.slug = await this.productSlugService.generateUnique(
                dto.title,
                id,
            );
        } else if (dto.slug && dto.slug !== product.slug) {
            const normalizedSlug = this.slugService.generate(dto.slug);

            const exists = await this.productSlugService.exists(
                normalizedSlug,
                id,
            );

            if (exists) {
                throw new ConflictException(`Slug "${normalizedSlug}" already exists`);
            }

            productData.slug = normalizedSlug;
        }

        await this.productRepository.update(id, productData);

        return this.productRepository.findOneBy({ id });
    }
}