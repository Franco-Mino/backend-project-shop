export interface CreateOrderItem {
  productId: string;
  quantity: number;
}

export class CreateOrderCommand {
  readonly userId: string;
  readonly items: CreateOrderItem[];

  constructor(props: { userId: string; items: CreateOrderItem[] }) {
    this.userId = props.userId;
    this.items = props.items;
  }
}
