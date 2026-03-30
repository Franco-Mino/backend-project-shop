import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { faker } from '@faker-js/faker';

import { ChangePasswordHandler } from './change-password.handler';
import { ChangePasswordCommand } from './change-password.command';
import { User } from '../../../domain/entities/user.entity';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUserRepositoryMock() {
  return {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn(),
    incrementFailedAttempts: jest.fn(),
    resetFailedAttempts: jest.fn(),
    updateRoles: jest.fn(),
    updateActive: jest.fn(),
  };
}

function makePasswordServiceMock() {
  return {
    hash: jest.fn().mockResolvedValue('new_hashed_password'),
    compare: jest.fn().mockResolvedValue(true),
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(
    User.create({
      id: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      password: 'old_hashed_password',
      fullName: faker.person.fullName(),
    }),
    overrides,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ChangePasswordHandler', () => {
  let handler: ChangePasswordHandler;
  let userRepository: ReturnType<typeof makeUserRepositoryMock>;
  let passwordService: ReturnType<typeof makePasswordServiceMock>;

  beforeEach(() => {
    userRepository = makeUserRepositoryMock();
    passwordService = makePasswordServiceMock();

    handler = new ChangePasswordHandler(
      userRepository as any,
      passwordService as any,
    );
  });

  it('changes the password successfully', async () => {
    const user = makeUser();
    userRepository.findById.mockResolvedValue(user);
    userRepository.findByEmail.mockResolvedValue(user);

    const result = await handler.execute(
      new ChangePasswordCommand(user.id, 'oldPass', 'newPass'),
    );

    expect(result.message).toMatch(/updated/i);
    expect(userRepository.update).toHaveBeenCalledWith(user.id, {
      password: 'new_hashed_password',
    });
  });

  it('throws UnauthorizedException when current password is wrong', async () => {
    const user = makeUser();
    userRepository.findById.mockResolvedValue(user);
    userRepository.findByEmail.mockResolvedValue(user);
    passwordService.compare.mockResolvedValue(false);

    await expect(
      handler.execute(
        new ChangePasswordCommand(user.id, 'wrongPass', 'newPass'),
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new ChangePasswordCommand(faker.string.uuid(), 'old', 'new'),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('hashes the new password before updating', async () => {
    const user = makeUser();
    userRepository.findById.mockResolvedValue(user);
    userRepository.findByEmail.mockResolvedValue(user);

    await handler.execute(
      new ChangePasswordCommand(user.id, 'old', 'newPlainPass'),
    );

    expect(passwordService.hash).toHaveBeenCalledWith('newPlainPass');
  });
});
