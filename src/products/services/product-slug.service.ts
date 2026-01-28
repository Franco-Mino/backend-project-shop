import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { SlugService } from './slug.service';

/**
 * ProductSlugService
 * Responsabilidad: Orquestar la generación de slugs únicos para productos
 * 
 * Patrón: Strategy + Repository
 * - Usa SlugService para normalizar
 * - Usa ProductRepository para verificar unicidad
 * - Lanza ConflictException si hay duplicado (sin auto-resolver)
 */
@Injectable()
export class ProductSlugService {
    private readonly logger = new Logger('ProductSlugService');

    constructor(
        private readonly slugService: SlugService,
        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,
    ) { }

    /**
     * Genera un slug normalizado y GARANTIZA que sea único
     * 
     * Flujo:
     * 1. Normaliza el input con SlugService
     * 2. Verifica si existe en BD
     * 3. Si existe, LANZA ERROR (sin auto-resolver)
     * 
     * 
     * @param input - Texto a convertir a slug (ej: "Camiseta Adidas Premium")
     * @param excludeId - ID de producto a excluir (útil para updates)
     * @throws ConflictException si el slug ya existe
     * @returns slug único y garantizado
     */
    async generateUnique(input: string, excludeId?: string): Promise<string> {
        try {
            // 1. Normalizar slug
            const baseSlug = this.slugService.generate(input);
            this.logger.debug(`Base slug generated: "${baseSlug}"`);

            // 2. Verificar si ya existe en BD
            if (await this.exists(baseSlug, excludeId)) {
                this.logger.warn(`Slug "${baseSlug}" already exists.`);
                throw new ConflictException(
                    `Slug "${baseSlug}" already exists. Please provide a different title or slug.`
                );
            }

            // 3. Si no existe, retornar el slug único
            this.logger.log(`Slug is unique and available: "${baseSlug}"`);
            return baseSlug;

        } catch (error) {
            // Re-lanzar ConflictException si ya fue lanzada
            if (error instanceof ConflictException) {
                throw error;
            }

            this.logger.error(`Error generating slug for "${input}":`, error);
            throw error;
        }
    }

    /**
     * Valida si un slug existe en la BD
     * @param slug - Slug a validar
     * @param excludeId - ID a excluir (para updates)
     * @returns true si existe
     */
    async exists(slug: string, excludeId?: string): Promise<boolean> {
        const query = this.productRepository.createQueryBuilder('p')
            .where('p.slug = :slug', { slug });

        if (excludeId) {
            query.andWhere('p.id != :id', { id: excludeId });
        }

        const exists = await query.getOne();
        return !!exists;
    }
}
