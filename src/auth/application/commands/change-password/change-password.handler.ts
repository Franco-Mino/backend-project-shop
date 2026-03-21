import {
  Inject,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ChangePasswordCommand } from './change-password.command';
import { PasswordDomainService } from '../../../domain/services/password.domain-service';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';

/**
 * COMMAND HANDLER — ChangePasswordHandler
 *
 * El usuario cambia su propia contraseña, debiendo proveer la contraseña
 * actual para verificar identidad antes de actualizar.
 */
@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<
  ChangePasswordCommand,
  { message: string }
> {
  private readonly logger = new Logger(ChangePasswordHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
    private readonly passwordService: PasswordDomainService,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<{ message: string }> {
    const { userId, currentPassword, newPassword } = command;

    // Necesitamos el password hash → buscar por email con addSelect
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    // findById no trae password (select:false), así que lo buscamos por email
    const userWithPassword = await this.userRepository.findByEmail(user.email);
    if (!userWithPassword) {
      throw new NotFoundException(`User not found`);
    }

    const valid = await this.passwordService.compare(
      currentPassword,
      userWithPassword.password,
    );
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNew = await this.passwordService.hash(newPassword);
    await this.userRepository.update(userId, { password: hashedNew });

    this.logger.log(`Password changed for user: ${userId}`);
    return { message: 'Password updated successfully' };
  }
}
