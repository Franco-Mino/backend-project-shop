import { BadRequestException, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SlugService {
  private readonly logger = new Logger(SlugService.name);

  /**
   * Genera un slug a partir de un string (SRP: solo normaliza)
   * @throws BadRequestException si el input es vacío o produce un slug vacío
   */
  generate(input: string): string {
    if (!input || input.trim().length === 0) {
      throw new BadRequestException('Title cannot be empty for slug generation');
    }

    const slug = input
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\d{5,}/g, '')
      .replace(/[^a-z0-9\s_]/g, '')
      .replace(/(.)\1{2,}/g, '$1$1')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!slug) {
      throw new BadRequestException('Cannot generate slug from provided input');
    }

    this.logger.debug(`Generated slug: "${input}" -> "${slug}"`);
    return slug;
  }

  /**
   * Valida si un string es un slug válido
   */
  isValid(slug: string): boolean {
    return /^[a-z0-9]([a-z0-9_]*[a-z0-9])?$/.test(slug);
  }
}
