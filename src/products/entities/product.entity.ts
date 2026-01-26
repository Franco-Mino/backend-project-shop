import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { Gender } from "../enums/gender.enum";
import { IsEnum } from "class-validator";
import { ProductSize } from "../enums/product-size.enum";



@Entity()
@Index(['slug']) // ← crítico para SEO/búsquedas
@Index(['gender', 'stock']) // ← filtros comunes
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

    // Sizes pasarlo a una tabla, por su el admin quiere agregar mas opciones
    @Column({ type: 'enum', enum: ProductSize, array: true })
    sizes: ProductSize[];

    @Column({ type: 'enum', enum: Gender, array: true })
    gender: Gender[];

    // Tags

    // Images

}
