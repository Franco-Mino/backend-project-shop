export interface ProductCommand<TResponse = any> {
    execute(): Promise<TResponse>;
}