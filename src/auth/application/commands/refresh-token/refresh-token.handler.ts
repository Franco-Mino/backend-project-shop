import { Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RefreshTokenCommand } from './refresh-token.command';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity';
import {
  TOKEN_SERVICE_PORT,
  type ITokenService,
} from '../../../domain/ports/token.service.port';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';
import {
  REFRESH_TOKEN_REPOSITORY_PORT,
  type IRefreshTokenRepository,
} from '../../../domain/ports/refresh-token.repository.port';

export interface RefreshTokenResult {
  token: string;
  refreshToken: string;
}

/**
 * COMMAND HANDLER — RefreshTokenHandler
 *
 * Estrategia de rotación:
 *   1. Verifica la firma JWT del refresh token
 *   2. Busca el jti en BD — rechaza si no existe, expirado o revocado
 *   3. Revoca el token actual
 *   4. Genera nuevo access token + nuevo refresh token
 *
 * La rotación garantiza que cada refresh token es de un solo uso.
 * Si alguien roba el token y lo usa primero, el segundo uso falla
 * porque el jti ya fue revocado.
 */
@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<
  RefreshTokenCommand,
  RefreshTokenResult
> {
  private readonly logger = new Logger(RefreshTokenHandler.name);
  private static readonly INVALID_TOKEN_MSG =
    'Invalid or expired refresh token';

  constructor(
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: ITokenService,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY_PORT)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const payload = this.tokenService.verifyRefreshToken(command.refreshToken);
    if (!payload) {
      throw new UnauthorizedException(RefreshTokenHandler.INVALID_TOKEN_MSG);
    }

    const stored = await this.refreshTokenRepository.findByJti(payload.jti);
    if (!stored || !stored.isValid()) {
      throw new UnauthorizedException(RefreshTokenHandler.INVALID_TOKEN_MSG);
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(RefreshTokenHandler.INVALID_TOKEN_MSG);
    }

    // Revocar el token actual (rotación)
    await this.refreshTokenRepository.revoke(payload.jti);

    // Emitir nuevos tokens
    const newAccessToken = this.tokenService.generateToken(user);
    const { raw, jti, expiresAt } =
      this.tokenService.generateRefreshToken(user);

    await this.refreshTokenRepository.create(
      RefreshToken.create({ id: jti, userId: user.id, expiresAt }),
    );

    this.logger.log(`Tokens rotated for user: ${user.id}`);
    return { token: newAccessToken, refreshToken: raw };
  }
}
