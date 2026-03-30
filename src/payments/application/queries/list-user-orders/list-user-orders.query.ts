export class ListUserOrdersQuery {
  constructor(
    readonly userId: string,
    readonly limit: number,
    readonly offset: number,
  ) {}
}
