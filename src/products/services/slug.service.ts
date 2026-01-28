import { BadRequestException, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SlugService {
    private readonly logger = new Logger('SlugService');

    /**
     * Genera un slug a partir de un string (SRP: solo normaliza)
     * @param input - String a convertir a slug
     * @returns slug normalizado (minúsculas, espacios como _, sin acentos, sin caracteres especiales, mantiene hasta 4 dígitos, elimina 5+, permite hasta 2 letras repetidas)
     * @throws BadRequestException si input es vacío o inválido
     */
    generate(input: string): string {
        if (!input || input.trim().length === 0) {
            throw new BadRequestException('Title cannot be empty for slug generation');
        }

        try {
            const slug = input
                .toLowerCase() // Minúsculas
                .trim() // elimina los espacios en blanco, tabulaciones y saltos de línea tanto al principio como al final
                .normalize('NFD') // Descompone caracteres acentuados
                .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos (acentos)
                .replace(/\d{5,}/g, '') // Elimina secuencias de 5+ dígitos (spam numérico), mantiene 1-4
                // Mantiene hasta 4 dígitos (ej: iPhone 15, Galaxy S24, Pizza 2025)
                .replace(/[^a-z0-9\s_]/g, '') // Solo letras, números 0-9, espacios y _
                .replace(/(.)\1{2,}/g, '$1$1') // Permite máximo 2 repeticiones (pizza → pizza, ssss → ss)
                .replace(/\s+/g, '_') // Espacios a guiones bajos
                .replace(/_+/g, '_') // Guiones bajos múltiples a uno
                .replace(/^_+|_+$/g, ''); // Trim de guiones bajos

            if (!slug) {
                throw new BadRequestException('Cannot generate slug from provided input');
            }

            this.logger.debug(`Generated slug: "${input}" -> "${slug}"`);
            return slug;
        } catch (error) {
            this.logger.error(`Error generating slug from "${input}":`, error);
            throw new BadRequestException('Failed to generate slug');
        }
    }

    /**
     * Valida si un string es un slug válido
     * @param slug - String a validar
     * @returns true si es válido
     */
    isValid(slug: string): boolean {
        // Acepta: letras (a-z), números (0-9), guiones bajos (_)
        const slugPattern = /^[a-z0-9]([a-z0-9_]*[a-z0-9])?$/;
        return slugPattern.test(slug);
    }
}
