import { Controller, Get, UseGuards } from '@nestjs/common';
import { SeedService } from './seed.service';
import { JwtAuthGuard } from '../auth/infrastructure/http/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/http/guards/roles.guard';
import { Roles } from '../auth/infrastructure/http/decorators/roles.decorator';
import { Role } from '../auth/domain/enums/role.enum';

/**
 * SEED CONTROLLER
 *
 * Protegido por JwtAuthGuard + RolesGuard(OWNER) para evitar que
 * cualquier usuario (o atacante) pueda borrar y recrear la base de datos.
 *
 * En CI el seeder no se usa — los tests crean sus propios datos.
 */
@Controller('seed')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  executeSeed() {
    return this.seedService.runSeed();
  }
}
