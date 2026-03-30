import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

/**
 * LoggerModule — "Caja negra" del servidor
 *
 * Registra cada request HTTP con: level, timestamp, método, URL,
 * status code y tiempo de respuesta.
 *
 * Campos NUNCA registrados (redactados con '[REDACTED]'):
 *   - Authorization header  → evita exponer JWT/Bearer tokens
 *   - Cookie header         → evita exponer sesiones
 *   - Set-Cookie header     → evita exponer cookies que setea el server
 *   - req.body.password     → contraseñas en texto plano
 *   - req.body.*token       → refresh tokens, reset tokens, etc.
 *   - req.body.*secret      → secrets o API keys en body
 *
 * En desarrollo (NODE_ENV=development): salida coloreada y legible (pino-pretty).
 * En cualquier otro entorno (test, production): JSON puro — apto para
 * cualquier log aggregator (Datadog, Loki, CloudWatch, Logtail, etc.).
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDevelopment = config.get<string>('NODE_ENV') === 'development';

        return {
          pinoHttp: {
            // En producción: info. En desarrollo: debug para ver más detalle.
            level: isDevelopment ? 'debug' : 'info',

            // ── Redacción de campos sensibles ────────────────────────────
            // pino reemplaza estos paths con '[REDACTED]' antes de escribir el log.
            // La redacción ocurre en memoria — el valor NUNCA toca el output.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'res.headers["set-cookie"]',
                'req.body.password',
                'req.body.currentPassword',
                'req.body.newPassword',
                'req.body.token',
                'req.body.refreshToken',
                'req.body.secret',
              ],
              censor: '[REDACTED]',
            },

            // ── Serializers: controlamos exactamente qué del req/res se loguea ─
            serializers: {
              req(req: {
                method: string;
                url: string;
                headers: Record<string, string>;
                remoteAddress: string;
              }) {
                return {
                  method: req.method,
                  url: req.url,
                  userAgent: req.headers['user-agent'] ?? 'unknown',
                  ip: req.remoteAddress,
                };
              },
              res(res: { statusCode: number }) {
                return { statusCode: res.statusCode };
              },
            },

            // ── Formato del campo "level" ────────────────────────────────
            // Por defecto pino escribe level como número (30 = info).
            // Esto lo convierte en texto legible: { "level": "info" }.
            formatters: {
              level(label: string) {
                return { level: label };
              },
            },

            // ── Transport ────────────────────────────────────────────────
            // Solo en desarrollo local usamos pino-pretty (colores, formato humano).
            // En test y producción: JSON crudo — eficiente y fácil de parsear.
            ...(isDevelopment && {
              transport: {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                  ignore: 'pid,hostname',
                  messageKey: 'msg',
                },
              },
            }),
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
