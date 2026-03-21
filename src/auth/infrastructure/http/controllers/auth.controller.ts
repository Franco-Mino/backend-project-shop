import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';

import { RegisterCommand } from '../../../application/commands/register/register.command';
import { LoginCommand } from '../../../application/commands/login/login.command';
import { UpdateProfileCommand } from '../../../application/commands/update-profile/update-profile.command';
import { ChangePasswordCommand } from '../../../application/commands/change-password/change-password.command';
import { RequestPasswordResetCommand } from '../../../application/commands/request-password-reset/request-password-reset.command';
import { ResetPasswordCommand } from '../../../application/commands/reset-password/reset-password.command';
import { RefreshTokenCommand } from '../../../application/commands/refresh-token/refresh-token.command';
import { LogoutCommand } from '../../../application/commands/logout/logout.command';
import { LoginResult } from '../../../application/commands/login/login.handler';
import { RefreshTokenResult } from '../../../application/commands/refresh-token/refresh-token.handler';

import { RegisterRequestDto } from '../dto/register.request.dto';
import { LoginRequestDto } from '../dto/login.request.dto';
import { UpdateProfileRequestDto } from '../dto/update-profile.request.dto';
import { ChangePasswordRequestDto } from '../dto/change-password.request.dto';
import { RequestPasswordResetRequestDto } from '../dto/request-password-reset.request.dto';
import { ResetPasswordRequestDto } from '../dto/reset-password.request.dto';
import { RefreshTokenRequestDto } from '../dto/refresh-token.request.dto';
import {
  AuthResponseDto,
  TokenPairResponseDto,
  UserResponseDto,
} from '../dto/auth.response.dto';
import { UserHttpMapper } from '../mappers/user.http-mapper';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetUser } from '../decorators/get-user.decorator';
import { User } from '../../../domain/entities/user.entity';

/**
 * HTTP ADAPTER — AuthController
 *
 * Endpoints públicos y del usuario autenticado.
 * Los endpoints de admin están en AdminController.
 *
 * POST   /auth/register                 → registro (5 req/min)
 * POST   /auth/login                    → login + JWT pair (5 req/min)
 * POST   /auth/refresh                  → rotar tokens (10 req/min)
 * POST   /auth/logout                   → revocar refresh tokens (JWT requerido)
 * GET    /auth/profile                  → perfil (JWT requerido)
 * PATCH  /auth/profile                  → editar nombre/email (JWT requerido)
 * PATCH  /auth/profile/password         → cambiar contraseña (JWT requerido)
 * POST   /auth/password-reset/request   → solicitar código (3 req/min)
 * POST   /auth/password-reset/reset     → resetear con código (5 req/min)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  // ─── Públicos ─────────────────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterRequestDto): Promise<UserResponseDto> {
    const user = await this.commandBus.execute<RegisterCommand, User>(
      new RegisterCommand({
        email: dto.email,
        password: dto.password,
        fullName: dto.fullName,
      }),
    );
    return UserHttpMapper.toUserResponse(user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginRequestDto): Promise<AuthResponseDto> {
    const result: LoginResult = await this.commandBus.execute(
      new LoginCommand({
        email: dto.email,
        password: dto.password,
        captchaToken: dto.captchaToken,
      }),
    );
    return UserHttpMapper.toAuthResponse(
      result.token,
      result.refreshToken,
      result.user,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(
    @Body() dto: RefreshTokenRequestDto,
  ): Promise<TokenPairResponseDto> {
    const result: RefreshTokenResult = await this.commandBus.execute(
      new RefreshTokenCommand(dto.refreshToken),
    );
    return UserHttpMapper.toTokenPair(result.token, result.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@GetUser() user: User): Promise<{ message: string }> {
    return this.commandBus.execute(new LogoutCommand(user.id));
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetRequestDto,
  ): Promise<{ message: string }> {
    return this.commandBus.execute(new RequestPasswordResetCommand(dto.email));
  }

  @Post('password-reset/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPassword(
    @Body() dto: ResetPasswordRequestDto,
  ): Promise<{ message: string }> {
    return this.commandBus.execute(
      new ResetPasswordCommand(dto.email, dto.code, dto.newPassword),
    );
  }

  // ─── Autenticado (JWT) ────────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@GetUser() user: User): UserResponseDto {
    return UserHttpMapper.toUserResponse(user);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @GetUser() user: User,
    @Body() dto: UpdateProfileRequestDto,
  ): Promise<UserResponseDto> {
    const updated = await this.commandBus.execute<UpdateProfileCommand, User>(
      new UpdateProfileCommand(user.id, dto.email, dto.fullName),
    );
    return UserHttpMapper.toUserResponse(updated);
  }

  @Patch('profile/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @GetUser() user: User,
    @Body() dto: ChangePasswordRequestDto,
  ): Promise<{ message: string }> {
    return this.commandBus.execute(
      new ChangePasswordCommand(user.id, dto.currentPassword, dto.newPassword),
    );
  }
}
