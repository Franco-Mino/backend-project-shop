import { Role } from '../enums/role.enum';

export interface CreateUserProps {
  id: string;
  email: string;
  password: string; // ya hasheada
  fullName: string;
  roles?: Role[];
}

/**
 * DOMAIN ENTITY — User (Aggregate Root)
 */
export class User {
  id: string;
  email: string;
  password: string;
  fullName: string;
  roles: Role[];
  isActive: boolean;
  failedLoginAttempts: number;

  static create(props: CreateUserProps): User {
    const user = new User();
    user.id = props.id;
    user.email = props.email.toLowerCase().trim();
    user.password = props.password;
    user.fullName = props.fullName;
    user.roles = props.roles ?? [Role.USER];
    user.isActive = true;
    user.failedLoginAttempts = 0;
    return user;
  }

  requiresCaptcha(): boolean {
    return this.failedLoginAttempts >= 3;
  }

  hasRole(role: Role): boolean {
    return this.roles.includes(role);
  }
}
