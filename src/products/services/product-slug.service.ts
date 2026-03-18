import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { Product } from '../entities';
import { SlugService } from './slug.service';

/**
 * Responsabilidad: orquestar la generación de slugs únicos para productos.
 * Usa SlugService para normalizar y verifica unicidad en BD.
 * Soporta EntityManager externo para operar dentro de transacciones.
 */
@Injectable()
export class ProductSlugService {
  private readonly logger = new Logger(ProductSlugService.name);

  constructor(
    private readonly slugService: SlugService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) { }

  /**
   * Genera un slug normalizado y garantiza que sea único.
   * @throws ConflictException si el slug ya existe
   */
  async generateUnique(
    input: string,
    excludeId?: string,
    manager?: EntityManager,
  ): Promise<string> {
    const baseSlug = this.slugService.generate(input);
    this.logger.debug(`Base slug generated: "${baseSlug}"`);

    if (await this.exists(baseSlug, excludeId, manager)) {
      this.logger.warn(`Slug "${baseSlug}" already exists.`);
      throw new ConflictException(
        `Slug "${baseSlug}" already exists. Please provide a different title or slug.`,
      );
    }

    this.logger.log(`Slug available: "${baseSlug}"`);
    return baseSlug;
  }

  /**
   * Verifica si un slug ya existe en BD.
   * @param excludeId - ID a excluir de la búsqueda (útil para updates)
   */
  async exists(
    slug: string,
    excludeId?: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager
      ? manager.getRepository(Product)
      : this.productRepository;

    const query = repo.createQueryBuilder('product').where('product.slug = :slug', { slug });

    if (excludeId) {
      query.andWhere('product.id != :id', { id: excludeId });
    }

    return !!(await query.getOne());
  }
}
