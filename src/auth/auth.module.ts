import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Domain
import { PasswordDomainService } from './domain/services/password.domain-service';
import { USER_REPOSITORY_PORT } from './domain/ports/user.repository.port';
import { TOKEN_SERVICE_PORT } from './domain/ports/token.service.port';
import { PASSWORD_RESET_TOKEN_REPOSITORY_PORT } from './domain/ports/password-reset-token.repository.port';
import { REFRESH_TOKEN_REPOSITORY_PORT } from './domain/ports/refresh-token.repository.port';
import { EMAIL_SERVICE_PORT } from './domain/ports/email.service.port';
import { CAPTCHA_SERVICE_PORT } from './domain/ports/captcha.service.port';

// Application — User commands
import { RegisterHandler } from './application/commands/register/register.handler';
import { LoginHandler } from './application/commands/login/login.handler';
import { UpdateProfileHandler } from './application/commands/update-profile/update-profile.handler';
import { ChangePasswordHandler } from './application/commands/change-password/change-password.handler';
import { RequestPasswordResetHandler } from './application/commands/request-password-reset/request-password-reset.handler';
import { ResetPasswordHandler } from './application/commands/reset-password/reset-password.handler';
import { RefreshTokenHandler } from './application/commands/refresh-token/refresh-token.handler';
import { LogoutHandler } from './application/commands/logout/logout.handler';

// Application — Admin commands & queries
import { ChangeUserRoleHandler } from './application/commands/change-user-role/change-user-role.handler';
import { ToggleUserStatusHandler } from './application/commands/toggle-user-status/toggle-user-status.handler';
import { ListUsersHandler } from './application/queries/list-users/list-users.handler';

// Infrastructure — Persistence
import { UserOrmEntity } from './infrastructure/persistence/entities/user.orm-entity';
import { PasswordResetTokenOrmEntity } from './infrastructure/persistence/entities/password-reset-token.orm-entity';
import { RefreshTokenOrmEntity } from './infrastructure/persistence/entities/refresh-token.orm-entity';
import { TypeOrmUserRepository } from './infrastructure/persistence/repositories/typeorm-user.repository';
import { TypeOrmPasswordResetTokenRepository } from './infrastructure/persistence/repositories/typeorm-password-reset-token.repository';
import { TypeOrmRefreshTokenRepository } from './infrastructure/persistence/repositories/typeorm-refresh-token.repository';

// Infrastructure — JWT
import { JwtStrategy } from './infrastructure/jwt/jwt.strategy';
import { JwtTokenAdapter } from './infrastructure/jwt/jwt-token.adapter';

// Infrastructure — Email
import { NodemailerEmailAdapter } from './infrastructure/email/nodemailer-email.adapter';

// Infrastructure — Captcha
import { GoogleRecaptchaAdapter } from './infrastructure/captcha/google-recaptcha.adapter';

// Infrastructure — HTTP
import { AuthController } from './infrastructure/http/controllers/auth.controller';
import { AdminController } from './infrastructure/http/controllers/admin.controller';

/**
 * AuthModule — Bounded Context de Autenticación
 *
 * Composition Root: aquí se conectan puertos con adaptadores.
 * Exporta PassportModule y JwtModule para que otros módulos
 * (como ProductsModule) puedan usar JwtAuthGuard.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      UserOrmEntity,
      PasswordResetTokenOrmEntity,
      RefreshTokenOrmEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '24h'),
        },
      }),
    }),
  ],
  controllers: [AuthController, AdminController],
  providers: [
    // Domain Services
    PasswordDomainService,

    // Port → Adapter bindings (Dependency Inversion)
    { provide: USER_REPOSITORY_PORT, useClass: TypeOrmUserRepository },
    { provide: TOKEN_SERVICE_PORT, useClass: JwtTokenAdapter },
    {
      provide: PASSWORD_RESET_TOKEN_REPOSITORY_PORT,
      useClass: TypeOrmPasswordResetTokenRepository,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY_PORT,
      useClass: TypeOrmRefreshTokenRepository,
    },
    { provide: EMAIL_SERVICE_PORT, useClass: NodemailerEmailAdapter },
    { provide: CAPTCHA_SERVICE_PORT, useClass: GoogleRecaptchaAdapter },

    // CQRS — Command Handlers
    RegisterHandler,
    LoginHandler,
    UpdateProfileHandler,
    ChangePasswordHandler,
    RequestPasswordResetHandler,
    ResetPasswordHandler,
    RefreshTokenHandler,
    LogoutHandler,
    ChangeUserRoleHandler,
    ToggleUserStatusHandler,

    // CQRS — Query Handlers
    ListUsersHandler,

    // Passport Strategy
    JwtStrategy,
  ],
  exports: [
    PassportModule,
    JwtModule,
    USER_REPOSITORY_PORT,
    TOKEN_SERVICE_PORT,
  ],
})
export class AuthModule {}
