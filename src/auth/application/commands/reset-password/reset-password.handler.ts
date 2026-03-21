import { BadRequestException, Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ResetPasswordCommand } from './reset-password.command';
import { PasswordDomainService } from '../../../domain/services/password.domain-service';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY_PORT,
  type IPasswordResetTokenRepository,
} from '../../../domain/ports/password-reset-token.repository.port';

/**
 * COMMAND HANDLER — ResetPasswordHandler
 *
 * Verifica el código de reset:
 *   1. El usuario existe y está activo
 *   2. Existe un token activo para ese usuario
 *   3. El código coincide con el hash almacenado
 *   4. El token no está expirado ni usado
 *   5. Actualiza la contraseña y marca el token como usado
 */
@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<
  ResetPasswordCommand,
  { message: string }
> {
  private readonly logger = new Logger(ResetPasswordHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY_PORT)
    private readonly tokenRepository: IPasswordResetTokenRepository,
    private readonly passwordService: PasswordDomainService,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<{ message: string }> {
    const { email, code, newPassword } = command;

    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const token = await this.tokenRepository.findActiveByUserId(user.id);
    if (!token) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    if (token.isExpired() || token.isUsed()) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const codeMatches = await this.passwordService.compare(
      code,
      token.hashedCode,
    );
    if (!codeMatches) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const hashedNew = await this.passwordService.hash(newPassword);
    await this.userRepository.update(user.id, { password: hashedNew });
    await this.tokenRepository.markAsUsed(token.id);

    this.logger.log(`Password reset completed for user: ${user.id}`);
    return { message: 'Password updated successfully' };
  }
}
