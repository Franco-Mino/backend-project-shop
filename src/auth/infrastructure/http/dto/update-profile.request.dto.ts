import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileRequestDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;
}
