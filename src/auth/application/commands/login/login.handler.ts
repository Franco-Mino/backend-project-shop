import { Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { LoginCommand } from './login.command';
import { User } from '../../../domain/entities/user.entity';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity';
import { PasswordDomainService } from '../../../domain/services/password.domain-service';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';
import {
  TOKEN_SERVICE_PORT,
  type ITokenService,
} from '../../../domain/ports/token.service.port';
import {
  REFRESH_TOKEN_REPOSITORY_PORT,
  type IRefreshTokenRepository,
} from '../../../domain/ports/refresh-token.repository.port';
import {
  CAPTCHA_SERVICE_PORT,
  type ICaptchaService,
} from '../../../domain/ports/captcha.service.port';

export interface LoginResult {
  token: string;
  refreshToken: string;
  user: User;
}

/** Máximo de sesiones simultáneas por usuario. Al superar este límite se revoca la más antigua. */
const MAX_ACTIVE_SESSIONS = 5;

/**
 * COMMAND HANDLER — LoginHandler
 *
 * Flujo completo:
 *   1. Busca el usuario por email
 *   2. Verifica que esté activo
 *   3. Si tiene ≥3 intentos fallidos → exige captcha válido
 *   4. Compara la contraseña
 *   5. En fallo: incrementa el contador de intentos
 *   6. En éxito: resetea el contador, genera access + refresh token
 *      Si el usuario ya tiene MAX_ACTIVE_SESSIONS activas, revoca la más antigua.
 *
 * El error es siempre genérico para no revelar si el email existe.
 */
@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<
  LoginCommand,
  LoginResult
> {
  private readonly logger = new Logger(LoginHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: ITokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY_PORT)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(CAPTCHA_SERVICE_PORT)
    private readonly captchaService: ICaptchaService,
    private readonly passwordService: PasswordDomainService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const { email, password, captchaToken } = command;

    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Si la cuenta tiene ≥3 intentos fallidos, exigir captcha
    if (user.requiresCaptcha()) {
      if (!captchaToken) {
        throw new UnauthorizedException({
          message: 'Too many failed attempts',
          requiresCaptcha: true,
        });
      }

      const captchaValid = await this.captchaService.verify(captchaToken);
      if (!captchaValid) {
        throw new UnauthorizedException({
          message: 'Invalid captcha',
          requiresCaptcha: true,
        });
      }
    }

    const passwordMatches = await this.passwordService.compare(
      password,
      user.password,
    );

    if (!passwordMatches) {
      await this.userRepository.incrementFailedAttempts(user.id);

      // Re-leer el contador actualizado para indicar si ahora requiere captcha
      const updatedAttempts = user.failedLoginAttempts + 1;
      if (updatedAttempts >= 3) {
        throw new UnauthorizedException({
          message: 'Invalid credentials',
          requiresCaptcha: true,
        });
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // Login exitoso — reset del contador y gestión de sesiones
    await this.userRepository.resetFailedAttempts(user.id);

    // Multi-device: si el usuario ya tiene el máximo de sesiones activas,
    // revoca la más antigua en lugar de revocar todas.
    const activeSessions =
      await this.refreshTokenRepository.countActiveByUserId(user.id);
    if (activeSessions >= MAX_ACTIVE_SESSIONS) {
      await this.refreshTokenRepository.revokeOldestByUserId(user.id);
    }

    const token = this.tokenService.generateToken(user);
    const { raw, jti, expiresAt } =
      this.tokenService.generateRefreshToken(user);

    const refreshTokenEntity = RefreshToken.create({
      id: jti,
      userId: user.id,
      expiresAt,
    });
    await this.refreshTokenRepository.create(refreshTokenEntity);

    this.logger.log(`User logged in: ${user.id}`);
    return { token, refreshToken: raw, user };
  }
}
