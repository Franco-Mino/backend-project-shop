import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { ChangeUserRoleCommand } from '../../../application/commands/change-user-role/change-user-role.command';
import { ToggleUserStatusCommand } from '../../../application/commands/toggle-user-status/toggle-user-status.command';
import { ListUsersQuery } from '../../../application/queries/list-users/list-users.query';

import { ChangeUserRoleRequestDto } from '../dto/change-user-role.request.dto';
import { UserResponseDto } from '../dto/auth.response.dto';
import { UserHttpMapper } from '../mappers/user.http-mapper';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { User } from '../../../domain/entities/user.entity';
import { PaginationDto } from '../../../../common/pagination/dto/pagination.dto';

/**
 * HTTP ADAPTER — AdminController
 *
 * Endpoints de gestión de usuarios protegidos por jerarquía de roles.
 * Todos requieren JWT válido. Los roles se validan por endpoint:
 *
 * GET   /auth/users                   → OWNER y ADMIN
 * PATCH /auth/users/:id/role          → solo OWNER
 * PATCH /auth/users/:id/status        → OWNER y ADMIN
 *
 * La asignación/remoción del rol OWNER solo puede hacerse
 * directamente en la base de datos — la API lo rechaza siempre.
 */
@Controller('auth/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @Roles(Role.ADMIN)
  async listUsers(
    @Query() pagination: PaginationDto,
  ): Promise<UserResponseDto[]> {
    const users = await this.queryBus.execute<ListUsersQuery, User[]>(
      new ListUsersQuery(pagination.limit, pagination.offset),
    );
    return UserHttpMapper.toUserResponseMany(users);
  }

  /**
   * Solo OWNER puede cambiar roles.
   * El handler rechaza cualquier intento de asignar o quitar el rol OWNER.
   */
  @Patch(':id/role')
  @Roles(Role.OWNER)
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserRoleRequestDto,
  ): Promise<UserResponseDto> {
    const user = await this.commandBus.execute<ChangeUserRoleCommand, User>(
      new ChangeUserRoleCommand(id, dto.roles),
    );
    return UserHttpMapper.toUserResponse(user);
  }

  /**
   * OWNER y ADMIN pueden activar/desactivar usuarios.
   * El handler protege que no se pueda desactivar a un OWNER.
   */
  @Patch(':id/status')
  @Roles(Role.ADMIN)
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
  ): Promise<UserResponseDto> {
    const user = await this.commandBus.execute<ToggleUserStatusCommand, User>(
      new ToggleUserStatusCommand(id, isActive),
    );
    return UserHttpMapper.toUserResponse(user);
  }
}
