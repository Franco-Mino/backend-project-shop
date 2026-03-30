import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import {
  CreatePaymentIntentResult,
  IPaymentService,
  ParsedWebhookEvent,
} from '../../domain/ports/payment.service.port';

/**
 * ADAPTER — StripePaymentAdapter
 *
 * Implementación concreta de IPaymentService usando Stripe.
 *
 * Responsabilidades de este adaptador:
 *   - Convertir el monto de decimales a centavos (requerido por Stripe)
 *   - Construir el objeto Stripe con la clave secreta
 *   - Verificar la firma del webhook para garantizar autenticidad
 *   - Mapear la respuesta de Stripe al contrato del port
 */
@Injectable()
export class StripePaymentAdapter implements IPaymentService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly logger = new Logger(StripePaymentAdapter.name);

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.getOrThrow<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.config.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    this.stripe = new Stripe(secretKey);
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<CreatePaymentIntentResult> {
    // Stripe trabaja en centavos: $29.99 → 2999
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      metadata,
      // automatic_payment_methods permite que el frontend use Stripe.js
      // sin configurar manualmente qué métodos de pago acepta
      automatic_payment_methods: { enabled: true },
    });

    this.logger.log(
      `PaymentIntent created: ${paymentIntent.id} — ${amountInCents} ${currency}`,
    );

    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
    };
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): ParsedWebhookEvent {
    // Stripe verifica que el payload proviene realmente de sus servidores
    // usando HMAC-SHA256 con el webhookSecret. Si la firma no coincide, lanza.
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );

    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    return {
      type: event.type,
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata as Record<string, string>,
    };
  }
}
