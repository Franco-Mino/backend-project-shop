import { ConflictException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateProfileCommand } from './update-profile.command';
import { User } from '../../../domain/entities/user.entity';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';

/**
 * COMMAND HANDLER — UpdateProfileHandler
 *
 * Permite al usuario actualizar su nombre o email.
 * Si el email cambia, verifica que no esté en uso por otro usuario.
 */
@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler
  implements ICommandHandler<UpdateProfileCommand, User>
{
  private readonly logger = new Logger(UpdateProfileHandler.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<User> {
    const { userId, email, fullName } = command;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    const changes: Partial<Pick<User, 'email' | 'fullName'>> = {};

    if (email && email.toLowerCase().trim() !== user.email) {
      const existing = await this.userRepository.findByEmail(email);
      if (existing) {
        throw new ConflictException(`Email "${email}" is already in use`);
      }
      changes.email = email.toLowerCase().trim();
    }

    if (fullName) {
      changes.fullName = fullName;
    }

    const updated = await this.userRepository.update(userId, changes);
    this.logger.log(`Profile updated for user: ${userId}`);
    return updated;
  }
}
