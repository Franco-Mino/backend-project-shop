import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtPayload } from '../../domain/ports/token.service.port';
import { User } from '../../domain/entities/user.entity';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../domain/ports/user.repository.port';

/**
 * JWT STRATEGY — JwtStrategy
 *
 * Infraestructura de Passport. Lee el token del header Authorization Bearer,
 * decodifica el payload y verifica que el usuario aún exista y esté activo.
 *
 * El objeto User que retorna validate() queda en req.user,
 * disponible en cualquier controller con @GetUser().
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Token invalid or user no longer active');
    }
    return user; // queda en req.user
  }
}
