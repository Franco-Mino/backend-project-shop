import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID, randomInt } from 'crypto';

import { RequestPasswordResetCommand } from './request-password-reset.command';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token.entity';
import { PasswordDomainService } from '../../../domain/services/password.domain-service';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY_PORT,
  type IPasswordResetTokenRepository,
} from '../../../domain/ports/password-reset-token.repository.port';
import {
  EMAIL_SERVICE_PORT,
  type IEmailService,
} from '../../../domain/ports/email.service.port';

const RESET_CODE_EXPIRY_MINUTES = 10;

/**
 * COMMAND HANDLER — RequestPasswordResetHandler
 *
 * Genera un código de 6 dígitos, lo hashea y lo almacena en DB.
 * Envía el código por email al usuario.
 *
 * SEGURIDAD: siempre responde el mismo mensaje genérico,
 * sin revelar si el email existe en la base de datos.
 */
@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetHandler
  implements ICommandHandler<RequestPasswordResetCommand, { message: string }>
{
  private readonly logger = new Logger(RequestPasswordResetHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY_PORT)
    private readonly tokenRepository: IPasswordResetTokenRepository,
    @Inject(EMAIL_SERVICE_PORT)
    private readonly emailService: IEmailService,
    private readonly passwordService: PasswordDomainService,
  ) {}

  async execute(
    command: RequestPasswordResetCommand,
  ): Promise<{ message: string }> {
    const genericResponse = {
      message: 'If the email is registered, a reset code was sent',
    };

    const user = await this.userRepository.findByEmail(command.email);
    if (!user || !user.isActive) {
      // No revelar si el email existe
      return genericResponse;
    }

    // Eliminar tokens anteriores del usuario
    await this.tokenRepository.deleteByUserId(user.id);

    // Generar código de 6 dígitos (100000–999999)
    const code = String(randomInt(100000, 1000000));

    // Hashear el código antes de guardarlo
    const hashedCode = await this.passwordService.hash(code);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + RESET_CODE_EXPIRY_MINUTES);

    const token = PasswordResetToken.create({
      id: randomUUID(),
      userId: user.id,
      hashedCode,
      expiresAt,
    });

    await this.tokenRepository.create(token);
    await this.emailService.sendPasswordResetCode(user.email, code);

    this.logger.log(`Password reset code sent to user: ${user.id}`);
    return genericResponse;
  }
}
