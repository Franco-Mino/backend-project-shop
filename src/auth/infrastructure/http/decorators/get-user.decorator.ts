import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../../domain/entities/user.entity';

/**
 * DECORATOR — @GetUser()
 *
 * Extrae el usuario autenticado de req.user (puesto por JwtStrategy).
 *
 * Uso:
 *   @GetUser() user: User          → objeto User completo
 *   @GetUser('id') userId: string  → solo el id
 */
export const GetUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: User }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
