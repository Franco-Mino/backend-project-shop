import { ForbiddenException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ChangeUserRoleCommand } from './change-user-role.command';
import { Role } from '../../../domain/enums/role.enum';
import { User } from '../../../domain/entities/user.entity';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';

/**
 * COMMAND HANDLER — ChangeUserRoleHandler
 *
 * Solo el OWNER puede invocar este handler (protegido en el controller).
 * Invariantes de dominio que se aplican aquí como segunda línea de defensa:
 *
 *   1. El rol OWNER no puede asignarse vía API (solo por BD directa).
 *   2. El rol OWNER no puede removerse de un usuario que ya lo tiene vía API.
 *
 * Esto garantiza que aunque el guard sea bypasseado, el dominio nunca
 * permita que la jerarquía sea corrompida por la API.
 */
@CommandHandler(ChangeUserRoleCommand)
export class ChangeUserRoleHandler
  implements ICommandHandler<ChangeUserRoleCommand, User>
{
  private readonly logger = new Logger(ChangeUserRoleHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: ChangeUserRoleCommand): Promise<User> {
    // Invariante 1: no se puede asignar el rol OWNER por API
    if (command.roles.includes(Role.OWNER)) {
      throw new ForbiddenException(
        'The OWNER role cannot be assigned via API',
      );
    }

    const targetUser = await this.userRepository.findById(command.targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Invariante 2: no se puede modificar los roles de un OWNER por API
    if (targetUser.roles.includes(Role.OWNER)) {
      throw new ForbiddenException(
        'Cannot modify the roles of an OWNER account',
      );
    }

    const updated = await this.userRepository.update(command.targetUserId, {
      roles: command.roles,
    });

    this.logger.log(
      `Roles updated for user ${command.targetUserId}: [${command.roles.join(', ')}]`,
    );
    return updated;
  }
}
