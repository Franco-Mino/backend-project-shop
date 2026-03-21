import { User } from '../../../domain/entities/user.entity';
import {
  AuthResponseDto,
  TokenPairResponseDto,
  UserResponseDto,
} from '../dto/auth.response.dto';

/**
 * HTTP MAPPER — UserHttpMapper
 *
 * Convierte entidades de dominio a DTOs de respuesta HTTP.
 * Nunca expone la contraseña hasheada ni campos internos.
 */
export class UserHttpMapper {
  static toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      isActive: user.isActive,
    };
  }

  static toUserResponseMany(users: User[]): UserResponseDto[] {
    return users.map((u) => UserHttpMapper.toUserResponse(u));
  }

  static toAuthResponse(
    token: string,
    refreshToken: string,
    user: User,
  ): AuthResponseDto {
    return {
      token,
      refreshToken,
      user: UserHttpMapper.toUserResponse(user),
    };
  }

  static toTokenPair(
    token: string,
    refreshToken: string,
  ): TokenPairResponseDto {
    return { token, refreshToken };
  }
}
