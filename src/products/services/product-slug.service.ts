import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Product } from '../entities';
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
 * - Soporta EntityManager externo para operar dentro de transacciones
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
     * Genera un slug normalizado y GARANTIZA que sea único.
     *
     * Flujo:
     * 1. Normaliza el input con SlugService
     * 2. Verifica si existe en BD (usando el manager de transacción si se provee)
     * 3. Si existe, LANZA ERROR (sin auto-resolver)
     *
     * @param input      - Texto a convertir a slug (ej: "Camiseta Adidas Premium")
     * @param excludeId  - ID de producto a excluir (útil para updates)
     * @param manager    - EntityManager transaccional opcional (QueryRunner.manager)
     * @throws ConflictException si el slug ya existe
     * @returns slug único y garantizado
     */
    async generateUnique(
        input: string,
        excludeId?: string,
        manager?: EntityManager,
    ): Promise<string> {
        try {
            const baseSlug = this.slugService.generate(input);
            this.logger.debug(`Base slug generated: "${baseSlug}"`);

            if (await this.exists(baseSlug, excludeId, manager)) {
                this.logger.warn(`Slug "${baseSlug}" already exists.`);
                throw new ConflictException(
                    `Slug "${baseSlug}" already exists. Please provide a different title or slug.`,
                );
            }

            this.logger.log(`Slug is unique and available: "${baseSlug}"`);
            return baseSlug;
        } catch (error) {
            if (error instanceof ConflictException) throw error;

            this.logger.error(`Error generating slug for "${input}":`, error);
            throw error;
        }
    }

    /**
     * Valida si un slug existe en la BD.
     *
     * @param slug       - Slug a validar
     * @param excludeId  - ID a excluir (para updates)
     * @param manager    - EntityManager transaccional opcional (QueryRunner.manager)
     * @returns true si existe
     */
    async exists(
        slug: string,
        excludeId?: string,
        manager?: EntityManager,
    ): Promise<boolean> {
        // Si hay un manager transaccional lo usamos para que la lectura
        // quede dentro de la misma transacción y vea los datos consistentes.
        const repo = manager
            ? manager.getRepository(Product)
            : this.productRepository;

        const query = repo
            .createQueryBuilder('p')
            .where('p.slug = :slug', { slug });

        if (excludeId) {
            query.andWhere('p.id != :id', { id: excludeId });
        }

        return !!(await query.getOne());
    }
}