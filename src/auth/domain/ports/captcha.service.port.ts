export const CAPTCHA_SERVICE_PORT = 'CAPTCHA_SERVICE_PORT';

export interface ICaptchaService {
  /**
   * Verifica un token de captcha generado por el cliente.
   * Retorna true si es válido, false si no.
   * Si el servicio no está configurado (dev), retorna true por defecto.
   */
  verify(token: string): Promise<boolean>;
}
