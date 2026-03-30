import { faker } from '@faker-js/faker';

import { Order } from '../../domain/entities/order.entity';
import { OrderItem } from '../../domain/entities/order-item.vo';
import { OrderStatus } from '../../domain/enums/order-status.enum';
import { IOrderRepository } from '../../domain/ports/order.repository.port';
import { IPaymentService } from '../../domain/ports/payment.service.port';

// ─── Order / OrderItem ───────────────────────────────────────────────────────

export function makeOrderItem(
  overrides: Partial<Parameters<typeof OrderItem.create>[0]> = {},
): OrderItem {
  return OrderItem.create({
    productId: faker.string.uuid(),
    quantity: faker.number.int({ min: 1, max: 5 }),
    unitPrice: faker.number.float({ min: 1, max: 999, fractionDigits: 2 }),
    ...overrides,
  });
}

export function makeOrder(
  overrides: Partial<Parameters<typeof Order.create>[0]> = {},
): Order {
  const items = overrides.items ?? [makeOrderItem(), makeOrderItem()];
  const totalAmount =
    overrides.totalAmount ??
    parseFloat(items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));

  return Order.create({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    items,
    totalAmount,
    status: OrderStatus.PENDING,
    stripePaymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
    createdAt: new Date(),
    ...overrides,
  });
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

export function makeOrderRepositoryMock(): jest.Mocked<IOrderRepository> {
  return {
    create: jest.fn(),
    updateStatus: jest.fn(),
    findById: jest.fn(),
    findByPaymentIntentId: jest.fn(),
  };
}

export function makePaymentServiceMock(): jest.Mocked<IPaymentService> {
  return {
    createPaymentIntent: jest.fn(),
    constructWebhookEvent: jest.fn(),
  };
}
