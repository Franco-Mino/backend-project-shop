import { Column, Entity } from "typeorm";
import { PrimaryGeneratedColumn } from "typeorm";
@Entity()
export class ProductImage {

    @PrimaryGeneratedColumn('uuid')
    id: number;


    @Column('text')
    url: string;
}