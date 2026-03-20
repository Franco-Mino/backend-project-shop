import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../domain/enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * DECORATOR — @Roles(...roles)
 *
 * Marca una ruta con los roles requeridos.
 * RolesGuard lo lee vía Reflector para hacer la validación.
 *
 * Uso: @Roles(Role.ADMIN)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
