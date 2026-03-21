import {
  ForbiddenException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ToggleUserStatusCommand } from './toggle-user-status.command';
import { Role } from '../../../domain/enums/role.enum';
import { User } from '../../../domain/entities/user.entity';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';

/**
 * COMMAND HANDLER — ToggleUserStatusHandler
 *
 * OWNER y ADMIN pueden activar/desactivar cuentas de usuario.
 * Invariante de dominio: el rol OWNER nunca puede desactivarse vía API.
 * Un OWNER desactivado bloquearía el acceso total al sistema sin
 * posibilidad de recuperarlo desde la propia API.
 */
@CommandHandler(ToggleUserStatusCommand)
export class ToggleUserStatusHandler implements ICommandHandler<
  ToggleUserStatusCommand,
  User
> {
  private readonly logger = new Logger(ToggleUserStatusHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: ToggleUserStatusCommand): Promise<User> {
    const targetUser = await this.userRepository.findById(command.targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Invariante: el OWNER no puede desactivarse por API
    if (targetUser.roles.includes(Role.OWNER)) {
      throw new ForbiddenException(
        'Cannot modify the status of an OWNER account',
      );
    }

    const updated = await this.userRepository.update(command.targetUserId, {
      isActive: command.isActive,
    });

    this.logger.log(
      `User ${command.targetUserId} status set to: ${command.isActive ? 'active' : 'inactive'}`,
    );
    return updated;
  }
}
