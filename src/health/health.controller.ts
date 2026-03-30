import { Controller, Get } from '@nestjs/common';

/**
 * Health check endpoint.
 *
 * Usado por Docker, load balancers, Kubernetes probes y servicios de
 * uptime monitoring para verificar que el servidor está vivo.
 *
 * GET /api/health → 200 OK
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
