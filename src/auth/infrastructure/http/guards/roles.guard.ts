import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Role } from '../../../domain/enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { User } from '../../../domain/entities/user.entity';

/**
 * Jerarquía de roles — mayor peso = mayor autoridad.
 * OWNER puede hacer todo lo que ADMIN puede, pero no al revés.
 * Para agregar un nuevo rol, solo se define su peso aquí.
 */
const ROLE_WEIGHT: Record<Role, number> = {
  [Role.OWNER]: 100,
  [Role.ADMIN]: 50,
  [Role.USER]: 10,
};

/**
 * GUARD — RolesGuard (hierarchy-aware)
 *
 * @Roles(Role.ADMIN) → pasan ADMIN y OWNER (peso >= 50)
 * @Roles(Role.OWNER) → solo pasa OWNER (peso >= 100)
 *
 * Debe usarse DESPUÉS de JwtAuthGuard.
 * Orden correcto: @UseGuards(JwtAuthGuard, RolesGuard)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: User }>();
    const user = request.user;

    const minRequiredWeight = Math.min(
      ...requiredRoles.map((r) => ROLE_WEIGHT[r]),
    );
    const userMaxWeight = Math.max(
      0,
      ...(user?.roles ?? []).map((r) => ROLE_WEIGHT[r] ?? 0),
    );

    if (userMaxWeight < minRequiredWeight) {
      throw new ForbiddenException('Access denied: insufficient privileges');
    }

    return true;
  }
}
