import { Role } from '../../../domain/enums/role.enum';

export class UserResponseDto {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  isActive: boolean;
}

export class AuthResponseDto {
  /** JWT de corta duración para autenticar peticiones. */
  token: string;
  /**
   * JWT de larga duración para obtener un nuevo access token.
   * Guardarlo de forma segura (httpOnly cookie en web, secure storage en mobile).
   */
  refreshToken: string;
  user: UserResponseDto;
}

export class TokenPairResponseDto {
  token: string;
  refreshToken: string;
}
