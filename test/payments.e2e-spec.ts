/**
 * E2E Tests — Payments Module
 *
 * Levanta la app completa con PostgreSQL real (igual que auth.e2e-spec.ts).
 * Stripe se mockea para que los tests no dependan de la API real.
 *
 * Qué testeamos end-to-end:
 *   1. POST /api/payments/checkout — flujo completo de compra
 *   2. GET  /api/payments/orders/:id — consulta de orden propia
 *   3. POST /api/payments/webhook — procesamiento de evento de Stripe
 *   4. Concurrencia: dos requests simultáneos sobre el mismo stock
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from 'src/AppModule';
import {
  IEmailService,
  EMAIL_SERVICE_PORT,
} from 'src/auth/domain/ports/email.service.port';
import {
  IPaymentService,
  PAYMENT_SERVICE_PORT,
} from 'src/payments/domain/ports/payment.service.port';
import { OrderStatus } from 'src/payments/domain/enums/order-status.enum';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockEmailService: IEmailService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
};

// Mockeamos Stripe para no necesitar API keys reales en tests
const mockPaymentService: jest.Mocked<IPaymentService> = {
  createPaymentIntent: jest.fn().mockResolvedValue({
    id: 'pi_test_e2e_123',
    clientSecret: 'pi_test_e2e_123_secret',
  }),
  constructWebhookEvent: jest.fn(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEED_USER = {
  email: `payments-e2e-${Date.now()}@example.com`,
  password: 'TestPass123!',
  fullName: 'Payments E2E User',
};

async function registerAndLogin(app: INestApplication<App>): Promise<string> {
  await request(app.getHttpServer()).post('/api/auth/register').send(SEED_USER);

  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: SEED_USER.email, password: SEED_USER.password });

  return res.body.accessToken as string;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let accessToken: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_SERVICE_PORT)
      .useValue(mockEmailService)
      .overrideProvider(PAYMENT_SERVICE_PORT)
      .useValue(mockPaymentService)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Crear usuario y obtener token
    accessToken = await registerAndLogin(app);

    // Crear producto de prueba con stock = 5
    // Para esto necesitamos un admin/owner — usamos el seed endpoint si existe,
    // o insertamos directo en DB para los tests
    productId = await dataSource
      .query(
        `INSERT INTO products (id, title, slug, price, stock, sizes, gender, tags, "isActive")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true)
         RETURNING id`,
        [
          `E2E Test Product ${Date.now()}`,
          `e2e-test-product-${Date.now()}`,
          29.99,
          5,
          '{M,L}',
          '{unisex}',
          '{e2e,test}',
        ],
      )
      .then((rows: { id: string }[]) => rows[0].id);
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await dataSource.query(
      `DELETE FROM orders WHERE "userId" IN (
      SELECT id FROM users WHERE email = $1
    )`,
      [SEED_USER.email],
    );
    await dataSource.query(
      `DELETE FROM products WHERE slug LIKE 'e2e-test-product-%'`,
    );
    await dataSource.query(`DELETE FROM users WHERE email = $1`, [
      SEED_USER.email,
    ]);
    await app.close();
  });

  beforeEach(() => {
    // Resetear mock de Stripe antes de cada test
    mockPaymentService.createPaymentIntent.mockResolvedValue({
      id: `pi_test_${Date.now()}`,
      clientSecret: `pi_test_${Date.now()}_secret`,
    });
  });

  // ─── SUITE 1: POST /api/payments/checkout ────────────────────────────────────

  describe('POST /api/payments/checkout', () => {
    it('should create an order and return orderId + clientSecret', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] })
        .expect(201);

      expect(res.body.orderId).toBeDefined();
      expect(res.body.clientSecret).toBeDefined();
      expect(res.body.clientSecret).toContain('_secret');
    });

    it('should call Stripe createPaymentIntent with correct amount', async () => {
      mockPaymentService.createPaymentIntent.mockClear();

      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] })
        .expect(201);

      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith(
        29.99,
        'usd',
        expect.objectContaining({ orderId: expect.any(String) }),
      );
    });

    it('should decrement product stock after checkout', async () => {
      // Leemos el stock inicial
      const before = await dataSource
        .query(`SELECT stock FROM products WHERE id = $1`, [productId])
        .then((rows: { stock: number }[]) => rows[0].stock);

      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] })
        .expect(201);

      const after = await dataSource
        .query(`SELECT stock FROM products WHERE id = $1`, [productId])
        .then((rows: { stock: number }[]) => rows[0].stock);

      expect(Number(after)).toBe(Number(before) - 1);
    });

    it('should return 409 when requesting more than available stock', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 9999 }] })
        .expect(409);
    });

    it('should return 404 when product does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          items: [
            { productId: '00000000-0000-0000-0000-000000000000', quantity: 1 },
          ],
        })
        .expect(404);
    });

    it('should return 401 without JWT token', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .send({ items: [{ productId, quantity: 1 }] })
        .expect(401);
    });

    it('should return 400 with invalid dto (quantity = 0)', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 0 }] })
        .expect(400);
    });

    it('should return 400 with empty items array', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [] })
        .expect(400);
    });
  });

  // ─── SUITE 2: GET /api/payments/orders/:id ───────────────────────────────────

  describe('GET /api/payments/orders/:id', () => {
    let orderId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] });

      orderId = res.body.orderId;
    });

    it('should return the order for the authenticated owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/payments/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(orderId);
      expect(res.body.status).toBe(OrderStatus.PENDING);
      expect(res.body.items).toHaveLength(1);
    });

    it('should return 403 when another user tries to access the order', async () => {
      // Crear otro usuario
      const otherUser = {
        email: `other-e2e-${Date.now()}@example.com`,
        password: 'TestPass123!',
        fullName: 'Other User',
      };
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(otherUser);
      const otherLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: otherUser.email, password: otherUser.password });

      await request(app.getHttpServer())
        .get(`/api/payments/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
        .expect(403);

      // Cleanup
      await dataSource.query(`DELETE FROM users WHERE email = $1`, [
        otherUser.email,
      ]);
    });

    it('should return 404 for non-existent order', async () => {
      await request(app.getHttpServer())
        .get('/api/payments/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // ─── SUITE 3: POST /api/payments/webhook ─────────────────────────────────────

  describe('POST /api/payments/webhook', () => {
    it('should mark order as PAID on payment_intent.succeeded', async () => {
      // Crear una orden primero
      const checkoutRes = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] });

      const { orderId, clientSecret } = checkoutRes.body;
      const piId = clientSecret.split('_secret')[0]; // extraemos el PI id del clientSecret

      // Configurar el mock de constructWebhookEvent
      mockPaymentService.constructWebhookEvent.mockReturnValueOnce({
        type: 'payment_intent.succeeded',
        paymentIntentId: piId,
        metadata: { orderId },
      });

      await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'mock_sig')
        .send(Buffer.from('{}'))
        .expect(200);

      // Verificar que la orden fue actualizada
      const orderRes = await request(app.getHttpServer())
        .get(`/api/payments/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(orderRes.body.status).toBe(OrderStatus.PAID);
    });

    it('should mark order as FAILED and restore stock on payment_intent.payment_failed', async () => {
      const checkoutRes = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] });

      const { orderId, clientSecret } = checkoutRes.body;
      const piId = clientSecret.split('_secret')[0];

      const stockBefore = await dataSource
        .query(`SELECT stock FROM products WHERE id = $1`, [productId])
        .then((rows: { stock: number }[]) => Number(rows[0].stock));

      mockPaymentService.constructWebhookEvent.mockReturnValueOnce({
        type: 'payment_intent.payment_failed',
        paymentIntentId: piId,
        metadata: { orderId },
      });

      await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'mock_sig')
        .send(Buffer.from('{}'))
        .expect(200);

      // Stock debe haber sido restaurado
      const stockAfter = await dataSource
        .query(`SELECT stock FROM products WHERE id = $1`, [productId])
        .then((rows: { stock: number }[]) => Number(rows[0].stock));

      expect(stockAfter).toBe(stockBefore + 1);
    });

    it('should return 400 when Stripe signature is invalid', async () => {
      mockPaymentService.constructWebhookEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'bad_sig')
        .send(Buffer.from('{}'))
        .expect(400);
    });
  });

  // ─── SUITE 4: Concurrencia ───────────────────────────────────────────────────

  describe('Stock concurrency', () => {
    it('should sell only available stock when two users buy simultaneously', async () => {
      // Crear un producto con stock = 1
      const lowStockProductId = await dataSource
        .query(
          `INSERT INTO products (id, title, slug, price, stock, sizes, gender, tags, "isActive")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true)
           RETURNING id`,
          [
            `Concurrent Product ${Date.now()}`,
            `concurrent-product-${Date.now()}`,
            9.99,
            1, // stock = 1
            '{M}',
            '{unisex}',
            '{concurrent}',
          ],
        )
        .then((rows: { id: string }[]) => rows[0].id);

      // Crear dos usuarios distintos
      const userA = {
        email: `concurrent-a-${Date.now()}@example.com`,
        password: 'TestPass123!',
        fullName: 'User A',
      };
      const userB = {
        email: `concurrent-b-${Date.now()}@example.com`,
        password: 'TestPass123!',
        fullName: 'User B',
      };

      await Promise.all([
        request(app.getHttpServer()).post('/api/auth/register').send(userA),
        request(app.getHttpServer()).post('/api/auth/register').send(userB),
      ]);

      const [tokenA, tokenB] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: userA.email, password: userA.password })
          .then((r) => r.body.accessToken as string),
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: userB.email, password: userB.password })
          .then((r) => r.body.accessToken as string),
      ]);

      // Ambos intentan comprar el único ítem al mismo tiempo
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/payments/checkout')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ items: [{ productId: lowStockProductId, quantity: 1 }] }),
        request(app.getHttpServer())
          .post('/api/payments/checkout')
          .set('Authorization', `Bearer ${tokenB}`)
          .send({ items: [{ productId: lowStockProductId, quantity: 1 }] }),
      ]);

      const statuses = [resA.status, resB.status];
      // Exactamente uno tiene que ser 201 (éxito) y el otro 409 (sin stock)
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);

      // El stock final debe ser 0
      const finalStock = await dataSource
        .query(`SELECT stock FROM products WHERE id = $1`, [lowStockProductId])
        .then((rows: { stock: number }[]) => Number(rows[0].stock));

      expect(finalStock).toBe(0);

      // Cleanup
      await dataSource.query(
        `DELETE FROM orders WHERE "userId" IN (
        SELECT id FROM users WHERE email IN ($1, $2)
      )`,
        [userA.email, userB.email],
      );
      await dataSource.query(`DELETE FROM products WHERE id = $1`, [
        lowStockProductId,
      ]);
      await dataSource.query(`DELETE FROM users WHERE email IN ($1, $2)`, [
        userA.email,
        userB.email,
      ]);
    });
  });
});
