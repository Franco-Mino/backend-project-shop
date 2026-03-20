import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import { IEmailService } from '../../domain/ports/email.service.port';

/**
 * ADAPTER — NodemailerEmailAdapter
 *
 * Implementación del port IEmailService usando Nodemailer.
 * Soporta cualquier proveedor SMTP: Gmail, SendGrid, AWS SES, Resend, etc.
 * Solo hay que cambiar las variables de entorno SMTP_*.
 */
@Injectable()
export class NodemailerEmailAdapter implements IEmailService {
  private readonly logger = new Logger(NodemailerEmailAdapter.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = configService.getOrThrow<string>('SMTP_FROM');

    this.transporter = nodemailer.createTransport({
      host: configService.getOrThrow<string>('SMTP_HOST'),
      port: configService.getOrThrow<number>('SMTP_PORT'),
      secure: configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: configService.getOrThrow<string>('SMTP_USER'),
        pass: configService.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async sendWelcomeEmail(to: string, fullName: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Welcome to Project Shop!',
        text: `Hi ${fullName}, welcome to Project Shop! Your account is ready.`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Welcome, ${fullName}! 🎉</h2>
            <p>Your account has been created successfully.</p>
            <p>You can now start shopping. If you have any questions, reply to this email.</p>
            <p style="color: #888; font-size: 13px; margin-top: 32px;">
              — The Project Shop team
            </p>
          </div>
        `,
      });
      this.logger.log(`Welcome email sent to: ${to}`);
    } catch (error) {
      // No lanzamos el error — el registro es exitoso aunque falle el email
      this.logger.error(
        `Failed to send welcome email to: ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Your password reset code',
        text: `Your reset code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Password Reset</h2>
            <p>Use the following code to reset your password. It expires in <strong>10 minutes</strong>.</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px;
                        background: #f4f4f4; padding: 16px 24px; border-radius: 8px;
                        text-align: center; margin: 24px 0;">
              ${code}
            </div>
            <p style="color: #888; font-size: 13px;">
              If you did not request a password reset, please ignore this email.
              Never share this code with anyone.
            </p>
          </div>
        `,
      });
      this.logger.log(`Password reset email sent to: ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send reset email to: ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
