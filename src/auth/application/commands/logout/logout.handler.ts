import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { LogoutCommand } from './logout.command';
import {
  REFRESH_TOKEN_REPOSITORY_PORT,
  type IRefreshTokenRepository,
} from '../../../domain/ports/refresh-token.repository.port';

/**
 * COMMAND HANDLER — LogoutHandler
 *
 * Revoca todos los refresh tokens activos del usuario.
 * El access token sigue siendo válido hasta que expire (por diseño JWT),
 * por eso se recomienda un TTL corto en producción (15 min).
 */
@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand, { message: string }> {
  private readonly logger = new Logger(LogoutHandler.name);

  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY_PORT)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(command: LogoutCommand): Promise<{ message: string }> {
    await this.refreshTokenRepository.revokeAllByUserId(command.userId);
    this.logger.log(`All refresh tokens revoked for user: ${command.userId}`);
    return { message: 'Logged out successfully' };
  }
}
