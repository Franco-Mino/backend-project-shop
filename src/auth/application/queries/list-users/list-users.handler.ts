import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListUsersQuery } from './list-users.query';
import { User } from '../../../domain/entities/user.entity';
import {
  USER_REPOSITORY_PORT,
  type IUserRepository,
} from '../../../domain/ports/user.repository.port';

/**
 * QUERY HANDLER — ListUsersHandler
 *
 * Lista paginada de todos los usuarios (admin only).
 */
@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery, User[]> {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: ListUsersQuery): Promise<User[]> {
    return this.userRepository.findAll({
      limit: query.limit,
      offset: query.offset,
    });
  }
}
