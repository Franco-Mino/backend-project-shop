import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ICaptchaService } from '../../domain/ports/captcha.service.port';

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * ADAPTER — GoogleRecaptchaAdapter
 *
 * Verifica tokens de Google reCAPTCHA v2 contra la API de Google.
 *
 * Si RECAPTCHA_SECRET_KEY no está configurada (entorno de desarrollo),
 * el adaptador aprueba cualquier token automáticamente para no
 * bloquear el desarrollo local.
 */
@Injectable()
export class GoogleRecaptchaAdapter implements ICaptchaService {
  private readonly logger = new Logger(GoogleRecaptchaAdapter.name);
  private readonly secretKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY');

    if (!this.secretKey) {
      this.logger.warn(
        'RECAPTCHA_SECRET_KEY not set — captcha verification is DISABLED (dev mode)',
      );
    }
  }

  async verify(token: string): Promise<boolean> {
    if (!this.secretKey) {
      return true; // dev bypass
    }

    try {
      const response = await fetch(RECAPTCHA_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.secretKey,
          response: token,
        }),
      });

      const data = (await response.json()) as { success: boolean; 'error-codes'?: string[] };

      if (!data.success) {
        this.logger.warn(`reCAPTCHA rejected token. Errors: ${data['error-codes']?.join(', ')}`);
      }

      return data.success;
    } catch (error) {
      this.logger.error(
        'Failed to verify reCAPTCHA token',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
}
