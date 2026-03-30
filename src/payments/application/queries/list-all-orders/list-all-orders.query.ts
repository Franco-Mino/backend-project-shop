export class ListAllOrdersQuery {
  constructor(
    readonly limit: number,
    readonly offset: number,
  ) {}
}
