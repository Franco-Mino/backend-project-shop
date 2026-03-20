import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  /** Requerido solo cuando el backend responde { requiresCaptcha: true }. */
  @IsOptional()
  @IsString()
  captchaToken?: string;
}
