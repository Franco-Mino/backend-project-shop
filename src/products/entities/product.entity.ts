import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Gender } from "../enums/gender.enum";
import { ProductSize } from "../enums/product-size.enum";
import { ProductImage } from './product-image.entity';

@Entity()
@Index(['isActive']) // Optimiza búsqueda de productos activos
@Index(['isActive', 'stock']) // Optimiza filtros combinados
@Index(['slug'], { unique: true }) // Aseguro la unicidad del slug
export class Product {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('text', { unique: true })
    title: string;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    price: number;

    @Column('text', { nullable: true })
    description: string;

    @Column('text', { unique: true })
    slug: string;

    @Column('int', { default: 0 })
    stock: number;

    @Column({ type: 'enum', enum: ProductSize, array: true })
    sizes: ProductSize[];

    @Column({ type: 'enum', enum: Gender, array: true })
    gender: Gender[];

    @Column('boolean', { default: true })
    isActive: boolean; // true = activo, false = eliminado (soft delete)


    @Column('text', { array: true, default: [] })
    tags: string[]; // Etiquetas asociadas al producto

    @OneToMany(
        () => ProductImage,
        (productImage) => productImage.product,
        { cascade: true, eager: true }
    )

    images: ProductImage[];

}
