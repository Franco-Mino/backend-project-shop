import { Injectable } from '@nestjs/common';

/**
 * DOMAIN SERVICE — SlugDomainService
 *
 * Responsabilidad única: normalizar strings a formato slug.
 * Es una función pura sin I/O — no habla con DB ni con nada externo.
 *
 * @Injectable() está permitido en domain services de NestJS porque
 * necesitamos inyección de dependencias, pero NO importamos nada de
 * infraestructura (TypeORM, AWS, etc.).
 */
@Injectable()
export class SlugDomainService {
  generate(input: string): string {
    if (!input?.trim()) {
      throw new Error('Input cannot be empty for slug generation');
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
      throw new Error('Cannot generate slug from provided input');
    }

    return slug;
  }

  isValid(slug: string): boolean {
    return /^[a-z0-9]([a-z0-9_]*[a-z0-9])?$/.test(slug);
  }
}
