import { IsArray, IsEnum } from 'class-validator';
import { Role } from '../../../domain/enums/role.enum';

export class ChangeUserRoleRequestDto {
  @IsArray()
  @IsEnum(Role, { each: true })
  roles: Role[];
}
