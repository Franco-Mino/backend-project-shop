import { ConflictException } from '@nestjs/common';
import { faker } from '@faker-js/faker';

import { RegisterHandler } from './register.handler';
import { RegisterCommand } from './register.command';
import { User } from '../../../domain/entities/user.entity';
import { Role } from '../../../domain/enums/role.enum';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUserRepositoryMock() {
  return {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    incrementFailedAttempts: jest.fn(),
    resetFailedAttempts: jest.fn(),
    updateRoles: jest.fn(),
    updateActive: jest.fn(),
  };
}

function makeEmailServiceMock() {
  return {
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
  };
}

function makePasswordServiceMock() {
  return {
    hash: jest.fn().mockResolvedValue('hashed_password'),
    compare: jest.fn(),
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(
    User.create({
      id: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      password: 'hashed_password',
      fullName: faker.person.fullName(),
      roles: [Role.USER],
    }),
    overrides,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RegisterHandler', () => {
  let handler: RegisterHandler;
  let userRepository: ReturnType<typeof makeUserRepositoryMock>;
  let emailService: ReturnType<typeof makeEmailServiceMock>;
  let passwordService: ReturnType<typeof makePasswordServiceMock>;

  beforeEach(() => {
    userRepository = makeUserRepositoryMock();
    emailService = makeEmailServiceMock();
    passwordService = makePasswordServiceMock();

    handler = new RegisterHandler(
      userRepository as any,
      emailService as any,
      passwordService as any,
    );
  });

  it('creates a user and returns it', async () => {
    const email = faker.internet.email();
    const command = new RegisterCommand({
      email,
      password: 'SecurePass1!',
      fullName: faker.person.fullName(),
    });
    const createdUser = makeUser({ email: email.toLowerCase() });

    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(createdUser);

    const result = await handler.execute(command);

    expect(result).toBe(createdUser);
    expect(userRepository.create).toHaveBeenCalledTimes(1);
    expect(passwordService.hash).toHaveBeenCalledWith('SecurePass1!');
  });

  it('sends a welcome email after creating the user', async () => {
    const command = new RegisterCommand({
      email: faker.internet.email(),
      password: 'SecurePass1!',
      fullName: 'Test User',
    });
    const createdUser = makeUser({ fullName: 'Test User' });

    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(createdUser);

    await handler.execute(command);

    // Give the best-effort promise time to resolve
    await Promise.resolve();
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
      createdUser.email,
      createdUser.fullName,
    );
  });

  it('throws ConflictException when email is already registered', async () => {
    const email = 'existing@example.com';
    const command = new RegisterCommand({
      email,
      password: 'SecurePass1!',
      fullName: 'Test',
    });

    userRepository.findByEmail.mockResolvedValue(makeUser({ email }));

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('does NOT fail registration if welcome email throws', async () => {
    const command = new RegisterCommand({
      email: faker.internet.email(),
      password: 'SecurePass1!',
      fullName: 'Test',
    });
    const createdUser = makeUser();

    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(createdUser);
    emailService.sendWelcomeEmail.mockRejectedValue(new Error('SMTP down'));

    await expect(handler.execute(command)).resolves.toBeDefined();
  });

  it('normalizes email to lowercase before saving', async () => {
    const command = new RegisterCommand({
      email: 'UPPER@EXAMPLE.COM',
      password: 'SecurePass1!',
      fullName: 'Test',
    });
    const createdUser = makeUser({ email: 'upper@example.com' });

    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(createdUser);

    const result = await handler.execute(command);
    expect(result.email).toBe('upper@example.com');
  });
});
