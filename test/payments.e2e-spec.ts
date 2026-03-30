/**
 * E2E Tests — Payments Module
 *
 * Levanta la app completa con PostgreSQL real (igual que auth.e2e-spec.ts).
 * Stripe se mockea para que los tests no dependan de la API real.
 *
 * Escenarios cubiertos:
 *   1. POST   /api/payments/checkout          — flujo completo de compra
 *   2. GET    /api/payments/orders/:id         — consulta de orden propia
 *   3. GET    /api/payments/orders             — historial del usuario
 *   4. PATCH  /api/payments/orders/:id/cancel  — cancelar orden PENDING
 *   5. GET    /api/payments/admin/orders       — vista admin de todas las órdenes
 *   6. POST   /api/payments/webhook            — procesamiento de eventos Stripe
 *   7. Stock concurrency                       — dos compras simultáneas sobre 1 unidad
 *   8. GET    /api/health                      — health check
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

const ADMIN_USER = {
  email: `payments-admin-${Date.now()}@example.com`,
  password: 'AdminPass123!',
  fullName: 'Payments Admin',
};

async function registerUser(
  app: INestApplication<App>,
  user: { email: string; password: string; fullName: string },
): Promise<string> {
  await request(app.getHttpServer()).post('/api/auth/register').send(user);
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password });
  return res.body.accessToken as string;
}

async function insertProduct(
  dataSource: DataSource,
  stock = 5,
): Promise<string> {
  return dataSource
    .query(
      `INSERT INTO products (id, title, slug, price, stock, sizes, gender, tags, "isActive")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id`,
      [
        `E2E Test Product ${Date.now()}`,
        `e2e-test-product-${Date.now()}`,
        29.99,
        stock,
        '{M,L}',
        '{unisex}',
        '{e2e,test}',
      ],
    )
    .then((rows: { id: string }[]) => rows[0].id);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let accessToken: string;
  let adminToken: string;
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

    // Usuarios
    accessToken = await registerUser(app, SEED_USER);
    adminToken = await registerUser(app, ADMIN_USER);

    // Promover admin
    await dataSource.query(
      `UPDATE users SET roles = '{admin}' WHERE email = $1`,
      [ADMIN_USER.email],
    );
    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ADMIN_USER.email, password: ADMIN_USER.password });
    adminToken = adminLoginRes.body.accessToken as string;

    // Producto de prueba con stock = 10
    productId = await insertProduct(dataSource, 10);
  });

  afterAll(async () => {
    await dataSource.query(
      `DELETE FROM orders WHERE "userId" IN (
        SELECT id FROM users WHERE email IN ($1, $2)
      )`,
      [SEED_USER.email, ADMIN_USER.email],
    );
    await dataSource.query(
      `DELETE FROM products WHERE slug LIKE 'e2e-test-product-%'`,
    );
    await dataSource.query(`DELETE FROM users WHERE email IN ($1, $2)`, [
      SEED_USER.email,
      ADMIN_USER.email,
    ]);
    await app.close();
  });

  beforeEach(() => {
    mockPaymentService.createPaymentIntent.mockResolvedValue({
      id: `pi_test_${Date.now()}`,
      clientSecret: `pi_test_${Date.now()}_secret`,
    });
  });

  // ─── SUITE 0: Health check ───────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ─── SUITE 1: POST /api/payments/checkout ────────────────────────────────────

  describe('POST /api/payments/checkout', () => {
    it('creates an order and returns orderId + clientSecret', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] })
        .expect(201);

      expect(res.body.orderId).toBeDefined();
      expect(res.body.clientSecret).toContain('_secret');
    });

    it('calls Stripe createPaymentIntent with correct amount', async () => {
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

    it('decrements product stock after checkout', async () => {
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

    it('returns 409 when requesting more stock than available', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 9999 }] })
        .expect(409);
    });

    it('returns 404 when product does not exist', async () => {
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

    it('returns 401 without JWT token', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .send({ items: [{ productId, quantity: 1 }] })
        .expect(401);
    });

    it('returns 400 with invalid dto (quantity = 0)', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 0 }] })
        .expect(400);
    });

    it('returns 400 with empty items array', async () => {
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

    it('returns order for the authenticated owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/payments/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(orderId);
      expect(res.body.status).toBe(OrderStatus.PENDING);
      expect(res.body.items).toHaveLength(1);
    });

    it('returns 403 when another user tries to access the order', async () => {
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

      await dataSource.query(`DELETE FROM users WHERE email = $1`, [
        otherUser.email,
      ]);
    });

    it('returns 404 for non-existent order', async () => {
      await request(app.getHttpServer())
        .get('/api/payments/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // ─── SUITE 3: GET /api/payments/orders — historial del usuario ──────────────

  describe('GET /api/payments/orders', () => {
    it('returns the authenticated user order history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/payments/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // Todas las órdenes deben pertenecer al usuario
      const userRes = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`);
      const userId = userRes.body.id as string;
      (res.body as { userId: string }[]).forEach((order) => {
        expect(order.userId).toBe(userId);
      });
    });

    it('supports pagination (limit/offset)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/payments/orders?limit=1&offset=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/payments/orders')
        .expect(401);
    });
  });

  // ─── SUITE 4: PATCH /api/payments/orders/:id/cancel ─────────────────────────

  describe('PATCH /api/payments/orders/:id/cancel', () => {
    it('cancels a PENDING order and restores stock', async () => {
      const checkoutRes = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 2 }] });
      const orderId = checkoutRes.body.orderId as string;

      const stockBefore = await dataSource
        .query(`SELECT stock FROM products WHERE id = $1`, [productId])
        .then((rows: { stock: number }[]) => Number(rows[0].stock));

      const res = await request(app.getHttpServer())
        .patch(`/api/payments/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.status).toBe(OrderStatus.CANCELLED);

      const stockAfter = await dataSource
        .query(`SELECT stock FROM products WHERE id = $1`, [productId])
        .then((rows: { stock: number }[]) => Number(rows[0].stock));

      // Stock debe haberse restaurado en 2 unidades
      expect(stockAfter).toBe(stockBefore + 2);
    });

    it('returns 409 when trying to cancel a PAID order', async () => {
      const checkoutRes = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] });
      const { orderId, clientSecret } = checkoutRes.body;
      const piId = clientSecret.split('_secret')[0];

      // Simular pago exitoso vía webhook
      mockPaymentService.constructWebhookEvent.mockReturnValueOnce({
        type: 'payment_intent.succeeded',
        paymentIntentId: piId,
        metadata: { orderId },
      });
      await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'mock_sig')
        .send(Buffer.from('{}'));

      // Intentar cancelar una orden ya PAID
      await request(app.getHttpServer())
        .patch(`/api/payments/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);
    });

    it('returns 403 when another user tries to cancel', async () => {
      const checkoutRes = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] });
      const orderId = checkoutRes.body.orderId as string;

      // Otro usuario intenta cancelar
      const otherUser = {
        email: `cancel-other-${Date.now()}@example.com`,
        password: 'TestPass123!',
        fullName: 'Other',
      };
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(otherUser);
      const otherLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: otherUser.email, password: otherUser.password });

      await request(app.getHttpServer())
        .patch(`/api/payments/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
        .expect(403);

      await dataSource.query(`DELETE FROM users WHERE email = $1`, [
        otherUser.email,
      ]);
    });

    it('returns 404 for non-existent order', async () => {
      await request(app.getHttpServer())
        .patch(
          '/api/payments/orders/00000000-0000-0000-0000-000000000000/cancel',
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // ─── SUITE 5: GET /api/payments/admin/orders ────────────────────────────────

  describe('GET /api/payments/admin/orders', () => {
    it('admin can list all orders with pagination metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/payments/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.orders)).toBe(true);
      expect(typeof res.body.total).toBe('number');
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('respects pagination (limit=1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/payments/admin/orders?limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.orders).toHaveLength(1);
    });

    it('returns 403 for a regular user', async () => {
      await request(app.getHttpServer())
        .get('/api/payments/admin/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/payments/admin/orders')
        .expect(401);
    });
  });

  // ─── SUITE 6: POST /api/payments/webhook ─────────────────────────────────────

  describe('POST /api/payments/webhook', () => {
    it('marks order as PAID on payment_intent.succeeded', async () => {
      const checkoutRes = await request(app.getHttpServer())
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [{ productId, quantity: 1 }] });

      const { orderId, clientSecret } = checkoutRes.body;
      const piId = clientSecret.split('_secret')[0];

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

      const orderRes = await request(app.getHttpServer())
        .get(`/api/payments/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(orderRes.body.status).toBe(OrderStatus.PAID);
    });

    it('marks order as FAILED and restores stock on payment_intent.payment_failed', async () => {
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

      const stockAfter = await dataSource
        .query(`SELECT stock FROM products WHERE id = $1`, [productId])
        .then((rows: { stock: number }[]) => Number(rows[0].stock));

      expect(stockAfter).toBe(stockBefore + 1);
    });

    it('returns 400 when Stripe signature is invalid', async () => {
      mockPaymentService.constructWebhookEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'bad_sig')
        .send(Buffer.from('{}'))
        .expect(400);
    });

    it('ignores unknown event types and returns 200', async () => {
      mockPaymentService.constructWebhookEvent.mockReturnValueOnce({
        type: 'customer.created',
        paymentIntentId: 'pi_irrelevant',
        metadata: {},
      });

      await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'mock_sig')
        .send(Buffer.from('{}'))
        .expect(200);
    });
  });

  // ─── SUITE 7: Concurrencia ───────────────────────────────────────────────────

  describe('Stock concurrency', () => {
    it('sells only available stock when two users buy the last unit simultaneously', async () => {
      const lowStockProductId = await insertProduct(dataSource, 1);

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
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);

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
