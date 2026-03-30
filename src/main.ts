import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './AppModule';

async function bootstrap() {
  // rawBody: true expone el Buffer original del request.
  // Es necesario para verificar la firma HMAC del webhook de Stripe:
  // si el body pasara primero por el JSON parser, la firma no coincidiría.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Reemplaza el logger de NestJS por pino (JSON estructurado, alta performance).
  // Debe inicializarse antes que cualquier otro middleware para capturar todos los logs.
  app.useLogger(app.get(Logger));

  // HTTP security headers: elimina X-Powered-By, previene clickjacking, MIME-sniffing, etc.
  // En desarrollo deshabilitamos CSP para que Swagger UI pueda cargar sus assets inline.
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  // CORS: solo acepta orígenes explícitos en producción
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────────
  // Solo se expone fuera de producción. En producción la doc debe estar detrás
  // de autenticación o deshabilitada completamente.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Project Shop API')
      .setDescription(
        'REST API para e-commerce. Autenticación con JWT Bearer token.\n\n' +
          'Para endpoints protegidos: clic en "Authorize" e ingresá el access token ' +
          'obtenido de POST /api/auth/login.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', 'Registro, login, refresh token, perfil y contraseña')
      .addTag('admin', 'Gestión de usuarios (ADMIN y OWNER)')
      .addTag('products', 'Catálogo de productos')
      .addTag('payments', 'Checkout, órdenes y webhooks de Stripe')
      .addTag('health', 'Health check')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
