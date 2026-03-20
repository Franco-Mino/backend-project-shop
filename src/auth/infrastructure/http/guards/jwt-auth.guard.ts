import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * GUARD — JwtAuthGuard
 *
 * Activa la estrategia 'jwt' de Passport.
 * Uso en controller: @UseGuards(JwtAuthGuard)
 *
 * Si el token es inválido o falta, lanza 401 automáticamente.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
