/**
 * PORT — IPaymentService
 *
 * Abstracción del servicio de pagos. Hoy usa Stripe; mañana podría
 * ser MercadoPago u otro proveedor sin cambiar la capa de aplicación.
 *
 * Nota sobre montos: el dominio trabaja con valores decimales (ej: 29.99).
 * La conversión a centavos (que requiere Stripe) es responsabilidad
 * del adaptador, no del dominio.
 */

export const PAYMENT_SERVICE_PORT = 'PAYMENT_SERVICE_PORT';

export interface CreatePaymentIntentResult {
  /** ID del PaymentIntent en Stripe (se guarda en la orden) */
  id: string;
  /** Secret que el frontend usa con Stripe.js para confirmar el pago */
  clientSecret: string;
}

export interface ParsedWebhookEvent {
  type: string;
  paymentIntentId: string;
  metadata: Record<string, string>;
}

export interface IPaymentService {
  /**
   * Crea un PaymentIntent en Stripe.
   * @param amount  Monto en decimales (ej: 29.99 USD)
   * @param currency Código ISO 4217 (ej: 'usd')
   * @param metadata Datos adicionales que Stripe adjunta al evento
   */
  createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<CreatePaymentIntentResult>;

  /**
   * Verifica la firma del webhook y parsea el evento de Stripe.
   * Lanza excepción si la firma es inválida (previene ataques).
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): ParsedWebhookEvent;
}
