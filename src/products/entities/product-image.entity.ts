import { Column, Entity, ManyToOne } from "typeorm";
import { PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./product.entity";
@Entity()
export class ProductImage {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('text')
    url: string;

    @Column('boolean', { default: true })
    isActive: boolean; // true = activo, false = eliminado (soft delete)


    @ManyToOne(
        () => Product,
        (product) => product.images,
        { onDelete: 'CASCADE' }
    )
    product: Product;

}