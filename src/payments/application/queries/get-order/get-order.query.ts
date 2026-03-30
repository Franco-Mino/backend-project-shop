export class GetOrderQuery {
  readonly orderId: string;
  readonly userId: string;

  constructor(props: { orderId: string; userId: string }) {
    this.orderId = props.orderId;
    this.userId = props.userId;
  }
}
