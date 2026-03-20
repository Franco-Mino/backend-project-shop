/**
 * E2E Tests — Auth Module
 *
 * Levanta la aplicación completa (NestJS + PostgreSQL real) y prueba
 * los flujos de registro, login y acceso al perfil de extremo a extremo.
 *
 * La base de datos debe estar corriendo. En CI, es provista por el
 * service container de GitHub Actions. En local, usá docker-compose.
 *
 * El servicio de email se reemplaza por un mock para que los tests no
 * dependan de un servidor SMTP real.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from 'src/AppModule';
import { IEmailService, EMAIL_SERVICE_PORT } from 'src/auth/domain/ports/email.service.port';

// ─── Mock del servicio de email ──────────────────────────────────────────────
// Reemplazamos el adaptador SMTP real por uno que no hace nada.
// Así los tests no dependen de infraestructura de correo.
const mockEmailService: IEmailService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
};

// ─── Datos de prueba compartidos ─────────────────────────────────────────────
const TEST_USER = {
  email: `e2e-test-${Date.now()}@example.com`, // único por ejecución
  password: 'TestPass123!',
  fullName: 'E2E Test User',
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let accessToken: string;

  // ─── Setup ─────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_SERVICE_PORT)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Igual que en main.ts para que las validaciones de DTO funcionen
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );

    await app.init();

    // Guardamos la conexión para poder limpiar datos después
    dataSource = moduleFixture.get(DataSource);
  });

  // ─── Teardown ──────────────────────────────────────────────────────────────
  afterAll(async () => {
    // Limpiamos el usuario de prueba para no contaminar la DB de test
    await dataSource.query(
      `DELETE FROM users WHERE email = $1`,
      [TEST_USER.email],
    );
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 1: Registro
  // ─────────────────────────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('registra un nuevo usuario correctamente (201)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(TEST_USER)
        .expect(201);

      expect(response.body).toMatchObject({
        email: TEST_USER.email,
        fullName: TEST_USER.fullName,
      });
      // La contraseña nunca debe volver en la respuesta
      expect(response.body.password).toBeUndefined();
      // El email de bienvenida debe haberse "enviado" (mock)
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        TEST_USER.email,
        TEST_USER.fullName,
      );
    });

    it('rechaza email duplicado (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(TEST_USER)
        .expect(409);
    });

    it('rechaza contraseña débil (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...TEST_USER, email: 'otro@test.com', password: '12345678' })
        .expect(400);
    });

    it('rechaza email inválido (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...TEST_USER, email: 'no-es-un-email' })
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 2: Login
  // ─────────────────────────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('hace login y devuelve accessToken + refreshToken (200)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toMatchObject({ email: TEST_USER.email });

      // Guardamos el token para las suites siguientes
      accessToken = response.body.token;
    });

    it('rechaza credenciales incorrectas (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: TEST_USER.email, password: 'WrongPass999!' })
        .expect(401);
    });

    it('rechaza usuario inexistente (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'fantasma@example.com', password: 'TestPass123!' })
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 3: Perfil (ruta protegida)
  // ─────────────────────────────────────────────────────────────────────────
  describe('GET /api/auth/profile', () => {
    it('devuelve el perfil con JWT válido (200)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        email: TEST_USER.email,
        fullName: TEST_USER.fullName,
      });
    });

    it('rechaza sin token (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/profile')
        .expect(401);
    });

    it('rechaza con token inválido (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer token.falso.aqui')
        .expect(401);
    });
  });
});
