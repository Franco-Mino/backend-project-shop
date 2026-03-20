/**
 * QUERY — FindProductQuery
 *
 * Regla CQRS: las Queries solo leen estado, nunca lo modifican.
 * El term puede ser un UUID o un slug.
 */
export class FindProductQuery {
  constructor(public readonly term: string) {}
}
