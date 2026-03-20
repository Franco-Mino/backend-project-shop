import { ConflictException, Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';

import { RegisterCommand } from './register.command';
import { User } from '../../../domain/entities/user.entity';
import { PasswordDomainService } from '../../../domain/services/password.domain-service';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';
import {
  EMAIL_SERVICE_PORT,
  type IEmailService,
} from '../../../domain/ports/email.service.port';

/**
 * COMMAND HANDLER — RegisterHandler
 *
 * Orquesta el caso de uso "registro de usuario":
 *   1. Verifica que el email no esté en uso
 *   2. Hashea la contraseña
 *   3. Crea la entidad User
 *   4. Persiste vía IUserRepository
 *   5. Envía email de bienvenida (best-effort: no falla el registro si el mail falla)
 */
@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand, User> {
  private readonly logger = new Logger(RegisterHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
    @Inject(EMAIL_SERVICE_PORT)
    private readonly emailService: IEmailService,
    private readonly passwordService: PasswordDomainService,
  ) {}

  async execute(command: RegisterCommand): Promise<User> {
    const { email, password, fullName } = command;

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException(`Email "${email}" is already registered`);
    }

    const hashedPassword = await this.passwordService.hash(password);

    const user = User.create({
      id: randomUUID(),
      email,
      password: hashedPassword,
      fullName,
    });

    const created = await this.userRepository.create(user);

    // Best-effort: el email de bienvenida no debe bloquear el registro
    this.emailService.sendWelcomeEmail(created.email, created.fullName).catch((err) => {
      this.logger.error(`Welcome email failed for user ${created.id}`, err?.stack);
    });

    return created;
  }
}
