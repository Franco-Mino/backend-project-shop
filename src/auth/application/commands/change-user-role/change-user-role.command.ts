import { Role } from '../../../domain/enums/role.enum';

export class ChangeUserRoleCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly roles: Role[],
  ) {}
}
