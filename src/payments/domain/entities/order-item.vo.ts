/**
 * VALUE OBJECT — OrderItem
 *
 * Representa un ítem dentro de una orden. Es un Value Object: no tiene
 * identidad propia, su igualdad está definida por sus valores.
 *
 * Captura el precio al momento de la compra (unitPrice) para que cambios
 * futuros en el precio del producto no alteren órdenes históricas.
 */

export interface OrderItemProps {
  productId: string;
  quantity: number;
  unitPrice: number; // precio al momento de la compra, en la moneda del sistema
}

export class OrderItem {
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: number;

  private constructor(props: OrderItemProps) {
    this.productId = props.productId;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
  }

  static create(props: OrderItemProps): OrderItem {
    return new OrderItem(props);
  }

  /** Subtotal de este ítem (unitPrice × quantity) */
  get subtotal(): number {
    return parseFloat((this.unitPrice * this.quantity).toFixed(2));
  }
}
