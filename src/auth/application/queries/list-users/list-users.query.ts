export class ListUsersQuery {
  constructor(
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}
