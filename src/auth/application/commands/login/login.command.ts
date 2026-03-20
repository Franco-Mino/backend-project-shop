/**
 * COMMAND — LoginCommand
 *
 * Representa la intención de iniciar sesión.
 * La contraseña viaja en crudo — el handler la compara contra el hash.
 */
export class LoginCommand {
  readonly email: string;
  readonly password: string;
  readonly captchaToken?: string;

  constructor(props: { email: string; password: string; captchaToken?: string }) {
    this.email = props.email;
    this.password = props.password;
    this.captchaToken = props.captchaToken;
  }
}
