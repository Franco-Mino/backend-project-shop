/**
 * COMMAND — RegisterCommand
 *
 * Representa la intención de registrar un nuevo usuario.
 * Lleva los datos en crudo (contraseña sin hashear) —
 * el handler se encarga de hashearla antes de persistir.
 */
export class RegisterCommand {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;

  constructor(props: { email: string; password: string; fullName: string }) {
    this.email = props.email;
    this.password = props.password;
    this.fullName = props.fullName;
  }
}
