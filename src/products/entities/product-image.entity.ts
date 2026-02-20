import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./product-entity";

@Entity()
export class ProductImage {

    @PrimaryGeneratedColumn('uuid')
    id: string; // ← era number, debe ser string porque usás uuid

    @Column('text')
    url: string;

    @Column('boolean', { default: true })
    isActive: boolean;

    @ManyToOne(
        () => Product,
        (product) => product.images,
    )
    product: Product;
}