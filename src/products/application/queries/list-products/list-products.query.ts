/**
 * QUERY — ListProductsQuery
 *
 * Listado paginado de productos activos.
 */
export class ListProductsQuery {
  constructor(
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}
