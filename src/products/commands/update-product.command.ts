import { UpdateProductDto } from "../dto/update-product.dto";

export class UpdateProductCommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateProductDto,
    ) { }
}
