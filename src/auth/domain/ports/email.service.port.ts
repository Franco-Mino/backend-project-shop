export const EMAIL_SERVICE_PORT = 'EMAIL_SERVICE_PORT';

export interface IEmailService {
  sendWelcomeEmail(to: string, fullName: string): Promise<void>;
  sendPasswordResetCode(to: string, code: string): Promise<void>;
}
