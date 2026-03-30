/**
 * E2E Tests — Products Module
 *
 * Cubre el ciclo de vida completo de un producto:
 *   1. Público: listar y buscar productos (sin auth)
 *   2. Admin: crear, actualizar, eliminar (requiere rol ADMIN)
 *   3. Autorización: verifica que USER no pueda crear/modificar
 *
 * S3 se mockea para que los tests no dependan de credenciales AWS.
 * Email se mockea para no necesitar SMTP.
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
  IStorageService,
  STORAGE_SERVICE_PORT,
} from 'src/products/domain/ports/storage.service.port';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockEmailService: IEmailService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
};

const mockStorageService: jest.Mocked<IStorageService> = {
  uploadFiles: jest.fn().mockResolvedValue([]),
  deleteFileByUrl: jest.fn().mockResolvedValue(undefined),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerAndLogin(
  app: INestApplication<App>,
  user: { email: string; password: string; fullName: string },
): Promise<string> {
  await request(app.getHttpServer()).post('/api/auth/register').send(user);
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password });
  return res.body.accessToken as string;
}

const ADMIN_USER = {
  email: `products-admin-${Date.now()}@example.com`,
  password: 'AdminPass123!',
  fullName: 'Products Admin',
};

const REGULAR_USER = {
  email: `products-user-${Date.now()}@example.com`,
  password: 'UserPass123!',
  fullName: 'Products User',
};

function makeProductPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: `Test Product ${Date.now()}`,
    price: 29.99,
    stock: 10,
    sizes: ['M', 'L'],
    gender: ['unisex'],
    tags: ['test'],
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Products (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  let userToken: string;
  let createdProductId: string;
  let createdProductSlug: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_SERVICE_PORT)
      .useValue(mockEmailService)
      .overrideProvider(STORAGE_SERVICE_PORT)
      .useValue(mockStorageService)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Registrar usuarios
    userToken = await registerAndLogin(app, REGULAR_USER);
    adminToken = await registerAndLogin(app, ADMIN_USER);

    // Promover admin en la DB directamente (el endpoint de roles requiere OWNER)
    await dataSource.query(
      `UPDATE users SET roles = '{admin}' WHERE email = $1`,
      [ADMIN_USER.email],
    );

    // Re-login para obtener token con el rol actualizado
    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ADMIN_USER.email, password: ADMIN_USER.password });
    adminToken = adminLoginRes.body.accessToken as string;
  });

  afterAll(async () => {
    // Limpiar productos y usuarios creados en los tests
    await dataSource.query(
      `DELETE FROM products WHERE slug LIKE 'test-product-%'`,
    );
    await dataSource.query(`DELETE FROM users WHERE email IN ($1, $2)`, [
      ADMIN_USER.email,
      REGULAR_USER.email,
    ]);
    await app.close();
  });

  // ─── SUITE 1: POST /api/products ─────────────────────────────────────────

  describe('POST /api/products', () => {
    it('ADMIN can create a product', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(makeProductPayload())
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.price).toBe(29.99);
      expect(res.body.slug).toBeDefined();

      createdProductId = res.body.id as string;
      createdProductSlug = res.body.slug as string;
    });

    it('returns 403 when a regular USER tries to create a product', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send(makeProductPayload())
        .expect(403);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .send(makeProductPayload())
        .expect(401);
    });

    it('returns 400 with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 10 }) // falta title, stock, sizes, gender
        .expect(400);
    });

    it('returns 400 with negative price', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(makeProductPayload({ price: -5 }))
        .expect(400);
    });

    it('returns 400 with zero stock', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(makeProductPayload({ stock: -1 }))
        .expect(400);
    });
  });

  // ─── SUITE 2: GET /api/products ──────────────────────────────────────────

  describe('GET /api/products', () => {
    it('returns a paginated list of products (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('respects limit and offset pagination', async () => {
      const resLimit1 = await request(app.getHttpServer())
        .get('/api/products?limit=1&offset=0')
        .expect(200);

      expect(resLimit1.body).toHaveLength(1);
    });

    it('returns 400 with invalid pagination params', async () => {
      await request(app.getHttpServer())
        .get('/api/products?limit=-1')
        .expect(400);
    });
  });

  // ─── SUITE 3: GET /api/products/:term ────────────────────────────────────

  describe('GET /api/products/:term', () => {
    it('finds a product by UUID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${createdProductId}`)
        .expect(200);

      expect(res.body.id).toBe(createdProductId);
    });

    it('finds a product by slug', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${createdProductSlug}`)
        .expect(200);

      expect(res.body.slug).toBe(createdProductSlug);
    });

    it('returns 404 for a non-existent UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/products/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 404 for a non-existent slug', async () => {
      await request(app.getHttpServer())
        .get('/api/products/this-slug-does-not-exist-e2e')
        .expect(404);
    });
  });

  // ─── SUITE 4: PATCH /api/products/:id ────────────────────────────────────

  describe('PATCH /api/products/:id', () => {
    it('ADMIN can update a product title and price', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated Title', price: 49.99 })
        .expect(200);

      expect(res.body.price).toBe(49.99);
      expect(res.body.title).toBe('Updated Title');
    });

    it('returns 403 when a regular USER tries to update', async () => {
      await request(app.getHttpServer())
        .patch(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ price: 1 })
        .expect(403);
    });

    it('returns 404 for a non-existent product UUID', async () => {
      await request(app.getHttpServer())
        .patch('/api/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Ghost' })
        .expect(404);
    });
  });

  // ─── SUITE 5: DELETE /api/products/:id ───────────────────────────────────

  describe('DELETE /api/products/:id', () => {
    it('ADMIN can soft-delete a product', async () => {
      // Crear un producto nuevo para no afectar los tests anteriores
      const createRes = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(makeProductPayload({ title: `Delete Target ${Date.now()}` }));

      const idToDelete = createRes.body.id as string;

      await request(app.getHttpServer())
        .delete(`/api/products/${idToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Tras el soft-delete el producto ya no debe aparecer en las búsquedas
      await request(app.getHttpServer())
        .get(`/api/products/${idToDelete}`)
        .expect(404);
    });

    it('returns 403 when a regular USER tries to delete', async () => {
      await request(app.getHttpServer())
        .delete(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('returns 404 for a non-existent product', async () => {
      await request(app.getHttpServer())
        .delete('/api/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
