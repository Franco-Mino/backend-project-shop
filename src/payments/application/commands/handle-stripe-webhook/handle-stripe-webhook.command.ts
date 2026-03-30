export class HandleStripeWebhookCommand {
  readonly rawBody: Buffer;
  readonly signature: string;

  constructor(props: { rawBody: Buffer; signature: string }) {
    this.rawBody = props.rawBody;
    this.signature = props.signature;
  }
}
