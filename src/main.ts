import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
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
  app.use(helmet());

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

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
