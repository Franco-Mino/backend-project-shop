import { ConflictException, NotFoundException } from '@nestjs/common';
import { faker } from '@faker-js/faker';

import { CreateOrderHandler } from './create-order.handler';
import { CreateOrderCommand } from './create-order.command';
import { OrderStatus } from '../../../domain/enums/order-status.enum';
import {
  makeOrder,
  makeOrderRepositoryMock,
  makePaymentServiceMock,
} from '../../../__tests__/factories/payment.factory';
import {
  makeProduct,
  makeRepositoryMock,
} from '../../../../products/__tests__/factories/product.factory';

/**
 * Unit Tests — CreateOrderHandler
 *
 * Enseñanza: Testeamos el handler de forma aislada, mockeando los 3 puertos
 * (IOrderRepository, IPaymentService, IProductRepository). Cada test verifica
 * un comportamiento específico, sin base de datos ni Stripe real.
 */
describe('CreateOrderHandler', () => {
  let handler: CreateOrderHandler;
  let orderRepository: ReturnType<typeof makeOrderRepositoryMock>;
  let paymentService: ReturnType<typeof makePaymentServiceMock>;
  let productRepository: ReturnType<typeof makeRepositoryMock>;

  const PRODUCT_ID = faker.string.uuid();
  const USER_ID = faker.string.uuid();

  beforeEach(() => {
    orderRepository = makeOrderRepositoryMock();
    paymentService = makePaymentServiceMock();
    productRepository = makeRepositoryMock();

    handler = new CreateOrderHandler(
      orderRepository as any,
      paymentService as any,
      productRepository as any,
    );
  });

  function makeCommand(
    overrides: Partial<
      ConstructorParameters<typeof CreateOrderCommand>[0]
    > = {},
  ) {
    return new CreateOrderCommand({
      userId: USER_ID,
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
      ...overrides,
    });
  }

  function setupHappyPath(stockOverride = 10) {
    const product = makeProduct({
      id: PRODUCT_ID,
      stock: stockOverride,
      price: 25.0,
    });
    productRepository.findById.mockResolvedValue(product);
    productRepository.decrementStockBatch.mockResolvedValue(undefined);
    productRepository.restoreStockBatch.mockResolvedValue(undefined);

    paymentService.createPaymentIntent.mockResolvedValue({
      id: 'pi_test_123',
      clientSecret: 'pi_test_123_secret_abc',
    });

    const savedOrder = makeOrder({
      userId: USER_ID,
      status: OrderStatus.PENDING,
      stripePaymentIntentId: 'pi_test_123',
    });
    orderRepository.create.mockResolvedValue(savedOrder);

    return { product, savedOrder };
  }

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it('should create order and return clientSecret on success', async () => {
    const { savedOrder } = setupHappyPath();

    const result = await handler.execute(makeCommand());

    expect(result.order).toBe(savedOrder);
    expect(result.clientSecret).toBe('pi_test_123_secret_abc');
  });

  it('should call decrementStockBatch with correct items', async () => {
    setupHappyPath();
    await handler.execute(makeCommand());

    expect(productRepository.decrementStockBatch).toHaveBeenCalledWith([
      { productId: PRODUCT_ID, quantity: 2 },
    ]);
  });

  it('should create PaymentIntent with correct total amount', async () => {
    // 2 items × $25.00 = $50.00
    setupHappyPath();
    await handler.execute(makeCommand());

    expect(paymentService.createPaymentIntent).toHaveBeenCalledWith(
      50,
      'usd',
      expect.objectContaining({ orderId: expect.any(String) }),
    );
  });

  it('should persist order with stripePaymentIntentId', async () => {
    setupHappyPath();
    await handler.execute(makeCommand());

    const orderPassedToRepo = orderRepository.create.mock.calls[0][0];
    expect(orderPassedToRepo.stripePaymentIntentId).toBe('pi_test_123');
    expect(orderPassedToRepo.status).toBe(OrderStatus.PENDING);
  });

  // ─── Validación de producto ──────────────────────────────────────────────────

  it('should throw NotFoundException when product does not exist', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(handler.execute(makeCommand())).rejects.toThrow(
      NotFoundException,
    );
    expect(productRepository.decrementStockBatch).not.toHaveBeenCalled();
    expect(paymentService.createPaymentIntent).not.toHaveBeenCalled();
  });

  // ─── Stock insuficiente ──────────────────────────────────────────────────────

  it('should throw ConflictException when stock is insufficient', async () => {
    const product = makeProduct({ id: PRODUCT_ID, stock: 1 });
    productRepository.findById.mockResolvedValue(product);
    // decrementStockBatch lanza ConflictException (como lo hace el adapter real)
    productRepository.decrementStockBatch.mockRejectedValue(
      new ConflictException('Insufficient stock for "Test Product"'),
    );

    await expect(
      handler.execute(
        makeCommand({ items: [{ productId: PRODUCT_ID, quantity: 5 }] }),
      ),
    ).rejects.toThrow(ConflictException);
    expect(paymentService.createPaymentIntent).not.toHaveBeenCalled();
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  // ─── Rollback de stock si Stripe falla ──────────────────────────────────────

  it('should restore stock if Stripe createPaymentIntent fails', async () => {
    const product = makeProduct({ id: PRODUCT_ID, stock: 10 });
    productRepository.findById.mockResolvedValue(product);
    productRepository.decrementStockBatch.mockResolvedValue(undefined);
    productRepository.restoreStockBatch.mockResolvedValue(undefined);

    paymentService.createPaymentIntent.mockRejectedValue(
      new Error('Stripe API error'),
    );

    await expect(handler.execute(makeCommand())).rejects.toThrow(
      'Stripe API error',
    );

    expect(productRepository.restoreStockBatch).toHaveBeenCalledWith([
      { productId: PRODUCT_ID, quantity: 2 },
    ]);
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it('should restore stock if order persistence fails', async () => {
    const product = makeProduct({ id: PRODUCT_ID, stock: 10 });
    productRepository.findById.mockResolvedValue(product);
    productRepository.decrementStockBatch.mockResolvedValue(undefined);
    productRepository.restoreStockBatch.mockResolvedValue(undefined);

    paymentService.createPaymentIntent.mockResolvedValue({
      id: 'pi_123',
      clientSecret: 'secret',
    });
    orderRepository.create.mockRejectedValue(new Error('DB connection lost'));

    await expect(handler.execute(makeCommand())).rejects.toThrow(
      'DB connection lost',
    );

    expect(productRepository.restoreStockBatch).toHaveBeenCalledWith([
      { productId: PRODUCT_ID, quantity: 2 },
    ]);
  });

  // ─── Múltiples items ─────────────────────────────────────────────────────────

  it('should handle multiple items and calculate total correctly', async () => {
    const productA = makeProduct({ id: 'prod-a', price: 10.0 });
    const productB = makeProduct({ id: 'prod-b', price: 20.0 });

    productRepository.findById
      .mockResolvedValueOnce(productA)
      .mockResolvedValueOnce(productB);
    productRepository.decrementStockBatch.mockResolvedValue(undefined);
    paymentService.createPaymentIntent.mockResolvedValue({
      id: 'pi_multi',
      clientSecret: 'secret_multi',
    });
    orderRepository.create.mockResolvedValue(makeOrder());

    await handler.execute(
      makeCommand({
        items: [
          { productId: 'prod-a', quantity: 2 }, // 2 × 10 = 20
          { productId: 'prod-b', quantity: 3 }, // 3 × 20 = 60
        ],
      }),
    );

    expect(paymentService.createPaymentIntent).toHaveBeenCalledWith(
      80, // total = 80
      'usd',
      expect.any(Object),
    );
  });
});
