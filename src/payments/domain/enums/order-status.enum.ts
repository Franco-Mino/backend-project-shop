/**
 * ENUM — OrderStatus
 *
 * Ciclo de vida de una orden:
 *   PENDING    → creada, stock reservado, esperando confirmación de Stripe
 *   PAID       → Stripe confirmó el pago (webhook payment_intent.succeeded)
 *   FAILED     → Stripe falló o expiró (webhook payment_intent.payment_failed)
 *                Stock es restaurado en este estado.
 *   CANCELLED  → cancelada por el usuario mientras estaba PENDING.
 *                Stock es restaurado al cancelar.
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
