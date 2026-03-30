/**
 * DATA SOURCE para TypeORM CLI
 *
 * Este archivo es EXCLUSIVO para la CLI de TypeORM (generar y correr migrations).
 * La aplicación NestJS usa TypeOrmModule.forRootAsync en AppModule, no este archivo.
 *
 * Comandos disponibles (ver package.json):
 *   npm run migration:generate -- src/database/migrations/NombreDeLaMigración
 *   npm run migration:run
 *   npm run migration:revert
 *   npm run migration:show
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'project_shop',
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  // Escanea las entidades compiladas (dist/) para las migrations
  entities: [join(__dirname, '../../dist/**/*.orm-entity{.ts,.js}')],
  // Migrations generadas y aplicadas desde esta carpeta
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false, // NUNCA true en producción
  logging: false,
});
