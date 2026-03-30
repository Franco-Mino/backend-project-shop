export class CancelOrderCommand {
  constructor(
    readonly orderId: string,
    readonly userId: string,
  ) {}
}
