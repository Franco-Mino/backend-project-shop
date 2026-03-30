import { UnauthorizedException } from '@nestjs/common';
import { faker } from '@faker-js/faker';

import { LoginHandler } from './login.handler';
import { LoginCommand } from './login.command';
import { User } from '../../../domain/entities/user.entity';
import { Role } from '../../../domain/enums/role.enum';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUserRepositoryMock() {
  return {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    incrementFailedAttempts: jest.fn().mockResolvedValue(undefined),
    resetFailedAttempts: jest.fn().mockResolvedValue(undefined),
    updateRoles: jest.fn(),
    updateActive: jest.fn(),
  };
}

function makeTokenServiceMock() {
  return {
    generateToken: jest.fn().mockReturnValue('access_token'),
    generateRefreshToken: jest.fn().mockReturnValue({
      raw: 'raw_refresh_token',
      jti: faker.string.uuid(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }),
    verifyRefreshToken: jest.fn(),
  };
}

function makeRefreshTokenRepositoryMock() {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    revokeById: jest.fn(),
    revokeAllByUserId: jest.fn(),
    countActiveByUserId: jest.fn().mockResolvedValue(0),
    revokeOldestByUserId: jest.fn().mockResolvedValue(undefined),
  };
}

function makeCaptchaServiceMock() {
  return {
    verify: jest.fn().mockResolvedValue(true),
  };
}

function makePasswordServiceMock() {
  return {
    hash: jest.fn(),
    compare: jest.fn().mockResolvedValue(true),
  };
}

function makeActiveUser(overrides: Partial<User> = {}): User {
  const u = User.create({
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    password: 'hashed_password',
    fullName: faker.person.fullName(),
    roles: [Role.USER],
  });
  return Object.assign(u, overrides);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LoginHandler', () => {
  let handler: LoginHandler;
  let userRepository: ReturnType<typeof makeUserRepositoryMock>;
  let tokenService: ReturnType<typeof makeTokenServiceMock>;
  let refreshTokenRepository: ReturnType<typeof makeRefreshTokenRepositoryMock>;
  let captchaService: ReturnType<typeof makeCaptchaServiceMock>;
  let passwordService: ReturnType<typeof makePasswordServiceMock>;

  beforeEach(() => {
    userRepository = makeUserRepositoryMock();
    tokenService = makeTokenServiceMock();
    refreshTokenRepository = makeRefreshTokenRepositoryMock();
    captchaService = makeCaptchaServiceMock();
    passwordService = makePasswordServiceMock();

    handler = new LoginHandler(
      userRepository as any,
      tokenService as any,
      refreshTokenRepository as any,
      captchaService as any,
      passwordService as any,
    );
  });

  it('returns access + refresh token on valid credentials', async () => {
    const user = makeActiveUser();
    userRepository.findByEmail.mockResolvedValue(user);

    const result = await handler.execute(
      new LoginCommand({ email: user.email, password: 'correct' }),
    );

    expect(result.token).toBe('access_token');
    expect(result.refreshToken).toBe('raw_refresh_token');
    expect(result.user).toBe(user);
  });

  it('throws UnauthorizedException for unknown email', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      handler.execute(
        new LoginCommand({ email: 'unknown@x.com', password: 'pw' }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for inactive user', async () => {
    const user = makeActiveUser({ isActive: false });
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(
      handler.execute(new LoginCommand({ email: user.email, password: 'pw' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException and increments counter on wrong password', async () => {
    const user = makeActiveUser();
    userRepository.findByEmail.mockResolvedValue(user);
    passwordService.compare.mockResolvedValue(false);

    await expect(
      handler.execute(
        new LoginCommand({ email: user.email, password: 'wrong' }),
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(userRepository.incrementFailedAttempts).toHaveBeenCalledWith(
      user.id,
    );
  });

  it('requires captcha when user has 3+ failed attempts', async () => {
    const user = makeActiveUser({ failedLoginAttempts: 3 });
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(
      handler.execute(new LoginCommand({ email: user.email, password: 'pw' })),
    ).rejects.toMatchObject({ response: { requiresCaptcha: true } });
  });

  it('accepts login when captcha is provided after 3+ failures', async () => {
    const user = makeActiveUser({ failedLoginAttempts: 3 });
    userRepository.findByEmail.mockResolvedValue(user);
    captchaService.verify.mockResolvedValue(true);

    const result = await handler.execute(
      new LoginCommand({
        email: user.email,
        password: 'correct',
        captchaToken: 'valid_token',
      }),
    );

    expect(result.token).toBe('access_token');
  });

  it('throws when captcha token is invalid', async () => {
    const user = makeActiveUser({ failedLoginAttempts: 3 });
    userRepository.findByEmail.mockResolvedValue(user);
    captchaService.verify.mockResolvedValue(false);

    await expect(
      handler.execute(
        new LoginCommand({
          email: user.email,
          password: 'pw',
          captchaToken: 'bad',
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('resets failed attempts counter on successful login', async () => {
    const user = makeActiveUser({ failedLoginAttempts: 2 });
    userRepository.findByEmail.mockResolvedValue(user);

    await handler.execute(
      new LoginCommand({ email: user.email, password: 'correct' }),
    );

    expect(userRepository.resetFailedAttempts).toHaveBeenCalledWith(user.id);
  });

  it('revokes oldest session when MAX_ACTIVE_SESSIONS is reached', async () => {
    const user = makeActiveUser();
    userRepository.findByEmail.mockResolvedValue(user);
    refreshTokenRepository.countActiveByUserId.mockResolvedValue(5);

    await handler.execute(
      new LoginCommand({ email: user.email, password: 'correct' }),
    );

    expect(refreshTokenRepository.revokeOldestByUserId).toHaveBeenCalledWith(
      user.id,
    );
  });
});
