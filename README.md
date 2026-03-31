<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# Project Shop API

REST API para una tienda online construida con **NestJS**, **TypeScript**, **PostgreSQL** y **Docker**.
Arquitectura hexagonal (Ports & Adapters) + patrón CQRS.

![CI](https://github.com/<TU-USUARIO-GITHUB>/project-shop/actions/workflows/ci.yml/badge.svg)

> Reemplazá `<TU-USUARIO-GITHUB>` en la línea del badge con tu nombre de usuario real de GitHub.

---

## Tabla de contenidos

1. [Stack tecnológico](#stack-tecnológico)
2. [Requisitos previos](#requisitos-previos)
3. [Inicio rápido con Docker](#inicio-rápido-con-docker)
4. [Desarrollo local sin Docker](#desarrollo-local-sin-docker)
5. [Variables de entorno](#variables-de-entorno)
6. [Generar un JWT_SECRET seguro](#generar-un-jwt_secret-seguro)
7. [Tests](#tests)
8. [CI/CD con GitHub Actions](#cicd-con-github-actions)
9. [Endpoints de la API](#endpoints-de-la-api)
10. [Arquitectura del proyecto](#arquitectura-del-proyecto)
11. [Checklist de producción](#checklist-de-producción)
12. [Troubleshooting](#troubleshooting)

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | NestJS | 11 |
| Lenguaje | TypeScript | 5.7 |
| Runtime | Node.js | 20 (Alpine) |
| Base de datos | PostgreSQL | 14 |
| ORM | TypeORM | 0.3 |
| Autenticación | JWT + Passport | — |
| Hash de contraseñas | bcrypt | 6 |
| Pagos | Stripe (PaymentIntents + Webhooks) | — |
| Email | Nodemailer (SMTP) | 8 |
| Almacenamiento | AWS S3 SDK v3 | — |
| Logging | nestjs-pino (JSON estructurado) | — |
| Docs API | Swagger / OpenAPI | — |
| Captcha | Google reCAPTCHA v2 | — |
| Rate limiting | @nestjs/throttler | 6 |
| Security headers | Helmet | 8 |
| Contenedores | Docker multi-stage | — |
| CI/CD | GitHub Actions | — |

---

## Requisitos previos

| Herramienta | Versión mínima | Para qué se usa |
|-------------|----------------|-----------------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 4.x | Levantar la DB y la app |
| [Node.js](https://nodejs.org/) | 20 LTS | Desarrollo sin Docker |
| [npm](https://www.npmjs.com/) | 10+ | Gestión de dependencias |
| [Stripe CLI](https://docs.stripe.com/stripe-cli) | 1.21+ | Webhooks en local |
| Cuenta de [AWS](https://aws.amazon.com/) | — | Bucket S3 para imágenes |
| Cuenta de [Stripe](https://stripe.com/) | — | Procesamiento de pagos |
| Cuenta SMTP | — | Envío de emails (Gmail, SendGrid, etc.) |

---

## Inicio rápido con Docker

Esta es la forma más simple de levantar todo el proyecto localmente.

### Paso 1 — Clonar el repositorio

```bash
git clone <repo-url>
cd project-shop
```

### Paso 2 — Configurar variables de entorno

```bash
cp .env.template .env
```

Abrí el archivo `.env` y completá **como mínimo** estas variables para poder arrancar:

```env
DB_PASSWORD=una_contraseña_local
JWT_SECRET=<generá uno seguro, ver sección abajo>
AWS_BUCKET_NAME=...
AWS_PUBLIC_KEY=...
AWS_SECRET_KEY=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
```

> Para desarrollo podés dejar `RECAPTCHA_SECRET_KEY=` vacío — el captcha se bypasea automáticamente.

### Paso 3 — Levantar la app

```bash
docker-compose up --build
```

Esto levanta:
- **PostgreSQL** en `localhost:5432`
- **API NestJS** en `http://localhost:3000`

La primera vez tarda un poco porque construye la imagen Docker. Los siguientes arranques son instantáneos.

### Paso 4 — Verificar que funciona

```bash
curl http://localhost:3000/api/health
# → { "status": "ok", "timestamp": "..." }
```

También podés acceder a la documentación interactiva en:
**[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

### Comandos útiles de Docker

```bash
# Levantar en background (sin ver los logs)
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f app
docker-compose logs -f db

# Detener contenedores (preserva los datos de la DB)
docker-compose down

# Detener y borrar TODOS los datos (útil para reset completo)
docker-compose down -v

# Levantar con pgAdmin — UI visual para explorar la DB
docker-compose --profile tools up
# Acceso: http://localhost:5050
# Login: valor de PGADMIN_EMAIL / PGADMIN_PASSWORD en tu .env (default: admin@admin.com / admin)

# Reconstruir la imagen después de cambiar dependencias o Dockerfile
docker-compose up --build
```

---

## Desarrollo local sin Docker

Si preferís correr la app directamente con Node.js (más rápido para iterar):

### Paso 1 — Instalar dependencias

```bash
npm install
```

### Paso 2 — Levantar solo la base de datos con Docker

```bash
docker-compose up db -d
```

### Paso 3 — Configurar `.env` para desarrollo local

Asegurate de que `DB_HOST=localhost` en tu `.env` (no `db`, que es el hostname dentro de Docker).

### Paso 4 — Correr en modo desarrollo (hot-reload)

```bash
npm run start:dev
```

La API arranca en `http://localhost:3000` con recarga automática al guardar archivos.

### Otros scripts disponibles

```bash
npm run build          # Compila TypeScript → JavaScript (dist/)
npm run start:prod     # Corre la versión compilada (requiere npm run build primero)
npm run lint           # Corre ESLint (detecta errores de tipos y estilo)
npm run format         # Formatea el código con Prettier
```

### Levantar el Stripe CLI para webhooks (terminal separada)

Cada vez que quieras probar el flujo de pagos, dejá esto corriendo en otra terminal:

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Copia el `whsec_...` que imprime al arrancar y ponelo en `.env` como `STRIPE_WEBHOOK_SECRET`.

> Si cerrás el CLI y lo volvés a abrir, el `whsec_...` cambia → actualizalo en `.env` y reiniciá el server.

**Resumen del flujo de pago en modo test:**
1. `POST /api/payments/checkout` → recibís `clientSecret`
2. El frontend usa Stripe.js con ese `clientSecret` para capturar el pago
3. Stripe envía el evento `payment_intent.succeeded` al CLI → el CLI lo redirige a tu server
4. El server marca la orden como `PAID`

Para simular un pago exitoso sin frontend:
```bash
stripe trigger payment_intent.succeeded
```

---

## Variables de entorno

Copiá `.env.template` a `.env` y completá cada variable. Descripción completa:

### App

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | `development` / `production` |
| `PORT` | Puerto de la API | `3000` |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos en producción (separados por coma) | `https://mi-tienda.com` |

### Base de datos

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DB_HOST` | Host de PostgreSQL | `localhost` (local) / `db` (Docker) |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `DB_NAME` | Nombre de la base de datos | `project_shop` |
| `DB_USERNAME` | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | cadena segura |

### JWT

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `JWT_SECRET` | Clave para firmar tokens. Ver [cómo generarla](#generar-un-jwt_secret-seguro) | hex de 64 bytes |
| `JWT_EXPIRES_IN` | Duración del access token | `15m`, `1h`, `24h` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Duración del refresh token en días | `7` |

### AWS S3

| Variable | Descripción |
|----------|-------------|
| `AWS_BUCKET_NAME` | Nombre del bucket S3 |
| `AWS_BUCKET_REGION` | Región AWS del bucket (ej: `us-east-1`) |
| `AWS_PUBLIC_KEY` | Access Key ID del usuario IAM |
| `AWS_SECRET_KEY` | Secret Access Key del usuario IAM |

> Usá un usuario IAM con permisos mínimos: solo `s3:PutObject` y `s3:DeleteObject` sobre ese bucket. Nunca uses credenciales de root de AWS.

### SMTP (email)

| Variable | Descripción |
|----------|-------------|
| `SMTP_HOST` | Servidor SMTP (`smtp.gmail.com`, `smtp.sendgrid.net`, etc.) |
| `SMTP_PORT` | Puerto SMTP (generalmente `587`) |
| `SMTP_SECURE` | TLS estricto: `true` para puerto 465, `false` para 587 |
| `SMTP_USER` | Usuario SMTP (tu email para Gmail) |
| `SMTP_PASS` | Contraseña SMTP (App Password para Gmail) |
| `SMTP_FROM` | Dirección remitente que verá el destinatario |

**Configurar Gmail:** Andá a tu cuenta de Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones. Generá una para "Correo".

### Stripe (pagos)

| Variable | Descripción |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Clave privada del servidor. `sk_test_...` en dev, `sk_live_...` en prod. [Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Generado por el Stripe CLI al correr `stripe listen`. Cambia cada vez que reiniciás el CLI. |

> En producción el `STRIPE_WEBHOOK_SECRET` se obtiene al crear el endpoint en el [Dashboard de Stripe](https://dashboard.stripe.com/webhooks), no desde el CLI.

### Captcha

| Variable | Descripción |
|----------|-------------|
| `RECAPTCHA_SECRET_KEY` | Secret key de Google reCAPTCHA v2. Si está vacía, el captcha se deshabilita. |

### pgAdmin (solo desarrollo local con Docker)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PGADMIN_EMAIL` | Email para login en pgAdmin | `admin@admin.com` |
| `PGADMIN_PASSWORD` | Contraseña para login en pgAdmin | `admin` |

---

## Generar un JWT_SECRET seguro

El `JWT_SECRET` firma todos los tokens de autenticación. Si alguien lo conoce, puede generar tokens válidos para cualquier usuario. Debe ser:
- Largo (mínimo 32 caracteres, recomendado 64 bytes)
- Aleatorio (no usar frases o palabras)
- Diferente por entorno (dev, staging, producción)

```bash
# Opción 1 — con Node.js (recomendado)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Opción 2 — con OpenSSL
openssl rand -hex 64
```

Copiá el resultado y pegalo como valor de `JWT_SECRET` en tu `.env`.

---

## Tests

### Tests unitarios

Prueban el dominio y los handlers de forma aislada (sin DB, sin red).

```bash
# Correr una vez
npm run test

# Modo watch (re-corre al guardar)
npm run test:watch

# Con reporte de coverage
npm run test:cov
```

El reporte de coverage se genera en `coverage/lcov-report/index.html`.

### Tests E2E (integración)

Prueban los endpoints HTTP completos contra una base de datos real.

```bash
# Paso 1: levantar la DB de test
docker-compose up db -d

# Paso 2: crear la base de datos de test (solo la primera vez)
# Conectate a postgres y ejecutá:
# CREATE DATABASE project_shop_test;

# Paso 3: correr los tests e2e
npm run test:e2e
```

Los tests e2e usan las variables de `.env.test`. El servicio de email es mockeado automáticamente (no envía emails reales). Los tests son destructivos — limpian la DB al inicio de cada ejecución.

---

## CI/CD con GitHub Actions

El pipeline está en [.github/workflows/ci.yml](.github/workflows/ci.yml) y corre automáticamente en:
- Cada `push` a `main` o `implementations`
- Cada Pull Request hacia `main`

### Estructura del pipeline

```
push / PR
    │
    ▼
┌─────────────────────────┐
│  JOB 1: test-unit       │  ~35s
│  • npm audit (prod)     │  Detecta vulnerabilidades en dependencias
│  • ESLint               │  Errores de tipos y estilo
│  • Jest unit tests      │  Con reporte de coverage
│  • Upload coverage      │  Artefacto disponible 7 días
└────────────┬────────────┘
             │ (solo si pasa)
      ┌──────┴──────┐
      ▼             ▼
┌──────────┐  ┌──────────────┐
│  JOB 2   │  │   JOB 3      │
│  test-e2e│  │ docker-build │
│  ~38s    │  │  ~17s        │
│  PostgreSQL  Construye la  │
│  real en CI  imagen Docker │
└──────────┘  └──────────────┘
```

### Sobre los valores en el job E2E

Los valores como `test_password`, `test_user` y `test_jwt_secret_for_ci` que ves en el archivo `ci.yml` **no son secrets reales**. Son credenciales de un contenedor PostgreSQL efímero que GitHub Actions levanta solo durante el job y destruye al terminar. No es accesible desde fuera del runner. Por eso es correcto tenerlos inline — no hay riesgo de seguridad.

### Agregar secretos reales a GitHub Actions

Si en el futuro necesitás usar variables sensibles en CI (por ejemplo, para hacer deploy automático), las configurás como **GitHub Secrets**:

1. Ir a tu repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Click en **New repository secret**
4. Agregar el nombre y valor (ej: `AWS_SECRET_KEY`)
5. En el workflow usar: `${{ secrets.AWS_SECRET_KEY }}`

---

## Endpoints de la API

Base URL: `http://localhost:3000/api`

### Auth

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/auth/register` | — | Registrar nuevo usuario |
| `POST` | `/auth/login` | — | Login — devuelve `token` + `refreshToken` |
| `POST` | `/auth/refresh` | — | Rotar access token usando `refreshToken` |
| `POST` | `/auth/logout` | JWT | Revocar refresh tokens |
| `GET` | `/auth/profile` | JWT | Ver perfil del usuario autenticado |
| `PATCH` | `/auth/profile` | JWT | Editar nombre o email |
| `PATCH` | `/auth/profile/password` | JWT | Cambiar contraseña |
| `POST` | `/auth/password-reset/request` | — | Solicitar código de reset por email |
| `POST` | `/auth/password-reset/reset` | — | Resetear contraseña con el código recibido |

### Admin (usuarios)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/auth/users` | JWT + ADMIN | Listar todos los usuarios |
| `PATCH` | `/auth/users/:id/role` | JWT + OWNER | Cambiar rol de un usuario |
| `PATCH` | `/auth/users/:id/status` | JWT + ADMIN | Activar o desactivar una cuenta |

### Productos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/products` | — | Listar productos (paginado con `?limit=10&offset=0`) |
| `GET` | `/products/:term` | — | Buscar por UUID o slug |
| `POST` | `/products` | JWT + ADMIN | Crear producto (soporta multipart/form-data para imágenes) |
| `PATCH` | `/products/:id` | JWT + ADMIN | Actualizar producto |
| `DELETE` | `/products/:id` | JWT + ADMIN | Eliminar producto (soft delete) |

### Pagos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/payments/checkout` | JWT | Crear orden + PaymentIntent de Stripe |
| `GET` | `/payments/orders` | JWT | Historial de órdenes del usuario (paginado) |
| `GET` | `/payments/orders/:id` | JWT | Detalle de una orden propia |
| `PATCH` | `/payments/orders/:id/cancel` | JWT | Cancelar orden en estado PENDING (restaura stock) |
| `GET` | `/payments/admin/orders` | JWT + ADMIN | Todas las órdenes del sistema con total |
| `POST` | `/payments/webhook` | — (firma HMAC) | Webhook de Stripe — no llamar manualmente |

### Sistema

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check (status + timestamp) |
| `GET` | `/docs` | — | Swagger UI interactivo (solo en dev/test) |
| `GET` | `/seed` | JWT + OWNER | Cargar datos de prueba en la DB |

### Cómo autenticarse en requests

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin1234!"}'

# Respuesta:
# { "token": "eyJ...", "refreshToken": "eyJ...", "user": {...} }

# 2. Usar el token en requests protegidos
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer eyJ..."
```

---

## Arquitectura del proyecto

El proyecto implementa **Arquitectura Hexagonal (Ports & Adapters)** con patrón **CQRS** por bounded context.

### Principio fundamental

El **dominio nunca depende del framework ni de la infraestructura**. El dominio define *contratos* (puertos/interfaces) y la infraestructura los implementa (adaptadores). La dirección de las dependencias siempre va hacia adentro (hacia el dominio).

```
HTTP Request
    │
    ▼
Controller (Infrastructure)
    │  ejecuta via CommandBus/QueryBus
    ▼
Handler (Application)
    │  llama via puerto (interface)
    ▼
Port (Domain — solo interface)
    │  implementado por
    ▼
Adapter (Infrastructure — TypeORM, Nodemailer, S3, etc.)
```

### Estructura de directorios

```
src/
├── AppModule.ts                     # Módulo raíz — configura DB, throttling, módulos
├── main.ts                          # Bootstrap: Helmet, CORS, pipes, puerto
│
├── auth/                            # Bounded context: autenticación y usuarios
│   ├── domain/
│   │   ├── entities/                # Entidades de dominio (sin decoradores de framework)
│   │   │   ├── user.entity.ts
│   │   │   ├── refresh-token.entity.ts
│   │   │   └── password-reset-token.entity.ts
│   │   ├── enums/
│   │   │   └── role.enum.ts         # USER | ADMIN
│   │   ├── ports/                   # Interfaces (contratos que el dominio exige)
│   │   │   ├── user.repository.port.ts
│   │   │   ├── refresh-token.repository.port.ts
│   │   │   ├── password-reset-token.repository.port.ts
│   │   │   ├── token.service.port.ts
│   │   │   ├── email.service.port.ts
│   │   │   └── captcha.service.port.ts
│   │   └── services/
│   │       └── password.domain-service.ts  # Hash y comparación de contraseñas
│   │
│   ├── application/                 # Casos de uso (CQRS handlers)
│   │   ├── commands/
│   │   │   ├── register/            # Registro de usuario + email de bienvenida
│   │   │   ├── login/               # Login + emisión de access + refresh token
│   │   │   ├── logout/              # Revocación de refresh tokens del usuario
│   │   │   ├── refresh-token/       # Rotación de tokens (single-use)
│   │   │   ├── update-profile/      # Editar nombre o email
│   │   │   ├── change-password/     # Cambiar contraseña (requiere contraseña actual)
│   │   │   ├── request-password-reset/  # Generar código y enviarlo por email
│   │   │   ├── reset-password/      # Validar código y cambiar contraseña
│   │   │   ├── change-user-role/    # Admin: asignar rol USER | ADMIN
│   │   │   └── toggle-user-status/  # Admin: activar o desactivar cuenta
│   │   └── queries/
│   │       └── list-users/          # Admin: listar usuarios con filtros
│   │
│   └── infrastructure/              # Adaptadores (implementaciones concretas)
│       ├── persistence/
│       │   ├── entities/            # Entidades ORM (decoradores de TypeORM)
│       │   ├── mappers/             # Conversión ORM entity ↔ Domain entity
│       │   └── repositories/        # Implementan los ports de repositorio
│       ├── jwt/
│       │   ├── jwt.strategy.ts      # Passport: valida el JWT en cada request
│       │   └── jwt-token.adapter.ts # Implementa token.service.port
│       ├── email/
│       │   └── nodemailer-email.adapter.ts  # Implementa email.service.port
│       ├── captcha/
│       │   └── google-recaptcha.adapter.ts  # Implementa captcha.service.port
│       └── http/
│           ├── controllers/         # AuthController, AdminController
│           ├── guards/              # JwtAuthGuard, RolesGuard
│           ├── decorators/          # @GetUser(), @Roles()
│           ├── dto/                 # Request y Response DTOs con validación
│           └── mappers/             # Domain entity → HTTP response
│
├── products/                        # Bounded context: catálogo de productos
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── product.entity.ts
│   │   │   └── product-image.entity.ts
│   │   ├── enums/
│   │   │   ├── gender.enum.ts       # MALE | FEMALE | UNISEX | KID
│   │   │   └── product-size.enum.ts # XS | S | M | L | XL | XXL
│   │   ├── events/
│   │   │   ├── product-created.event.ts   # Evento de dominio (extensible)
│   │   │   └── product-deleted.event.ts
│   │   ├── ports/
│   │   │   ├── product.repository.port.ts
│   │   │   └── storage.service.port.ts    # Abstracción de almacenamiento de archivos
│   │   └── services/
│   │       └── slug.domain-service.ts     # Generación de slugs únicos
│   │
│   ├── application/
│   │   ├── commands/
│   │   │   ├── create-product/      # Sube imágenes a S3, persiste producto
│   │   │   ├── update-product/      # Actualiza datos + gestiona imágenes en S3
│   │   │   └── delete-product/      # Elimina producto e imágenes de S3
│   │   └── queries/
│   │       ├── find-product/        # Busca por ID o slug
│   │       └── list-products/       # Lista paginada con filtros
│   │
│   └── infrastructure/
│       ├── persistence/             # TypeORM entities, mappers, repositories
│       ├── storage/
│       │   └── s3-storage.adapter.ts        # Implementa storage.service.port (AWS S3)
│       └── http/
│           ├── controllers/
│           │   └── products.controller.ts
│           ├── dto/                 # Incluye manejo de multipart/form-data
│           └── mappers/
│
├── seed/                            # Módulo para poblar la DB en desarrollo
│   ├── seed.controller.ts           # GET /seed
│   ├── seed.service.ts
│   └── data/seed-data.ts            # Datos de ejemplo
│
└── common/                          # Código compartido entre bounded contexts
    ├── pagination/dto/pagination.dto.ts
    └── pipes/files-validation.pipe.ts
```

### Seguridad implementada

| Mecanismo | Implementación |
|-----------|---------------|
| Hash de contraseñas | bcrypt con 10 salt rounds |
| Access tokens | JWT firmado, duración configurable (default 24h) |
| Refresh tokens | JWT de larga duración, jti almacenado en DB para revocación |
| Rotación de tokens | Cada uso del refresh token genera uno nuevo y revoca el anterior |
| Sesiones múltiples | Máximo 5 sesiones activas por usuario; la más antigua se revoca automáticamente |
| Rate limiting | Global: 60 req/min por IP. Endpoints sensibles: 5 req/min |
| Captcha | Requerido tras 3 intentos fallidos de login |
| Headers HTTP | Helmet (X-Content-Type-Options, X-Frame-Options, sin X-Powered-By, etc.) |
| CORS | Origen libre en desarrollo, lista explícita en producción via `ALLOWED_ORIGINS` |
| Validación de inputs | `ValidationPipe` global con `whitelist: true` (elimina campos no declarados) |
| TypeORM synchronize | Desactivado en producción — usa migraciones |

---

## Checklist de producción

Antes de deployar a producción, verificá cada punto:

- [ ] `JWT_SECRET` generado con `crypto.randomBytes(64)`, diferente al de desarrollo
- [ ] `DB_PASSWORD` segura y diferente a cualquier entorno de dev/test
- [ ] `NODE_ENV=production` configurado
- [ ] `ALLOWED_ORIGINS` apunta solo a tus dominios reales
- [ ] `RECAPTCHA_SECRET_KEY` configurado (no vacío)
- [ ] Credenciales AWS con permisos mínimos (solo S3 Put/Delete sobre el bucket específico)
- [ ] SMTP con App Password, no la contraseña real de tu cuenta
- [ ] `STRIPE_SECRET_KEY` en modo `sk_live_...` (no `sk_test_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` generado desde el Dashboard de Stripe (no desde el CLI)
- [ ] Webhook registrado en dashboard.stripe.com con la URL pública del servidor
- [ ] Imagen Docker construida desde el Dockerfile multi-stage (no `npm run start:dev`)
- [ ] TypeORM `synchronize: false` en producción (ya está configurado así)
- [ ] Ejecutar `npm run migration:run` antes del primer deploy y en cada cambio de schema
- [ ] Variables configuradas como secrets en el servicio de deployment (no como archivos .env en el servidor)

---

## Troubleshooting

### La API no conecta a la base de datos

**Síntoma:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Causas posibles:**
1. PostgreSQL no está corriendo — corré `docker-compose up db -d`
2. `DB_HOST` incorrecto: debe ser `localhost` si corrés la app con Node.js, o `db` si la corrés dentro de Docker con `docker-compose up`

---

### Error al levantar con `docker-compose up`

**Síntoma:** `Bind for 0.0.0.0:5432 failed: port is already allocated`

**Causa:** Tenés PostgreSQL instalado localmente corriendo en el mismo puerto.

**Solución:**
```bash
# Detener PostgreSQL local temporalmente
sudo service postgresql stop   # Linux
brew services stop postgresql  # macOS

# O cambiar el puerto del contenedor en docker-compose.yaml
ports:
  - "5433:5432"   # expone en 5433 localmente
# Y actualizar DB_PORT=5433 en .env
```

---

### Los tests e2e fallan con error de conexión

**Síntoma:** `Connection refused` al correr `npm run test:e2e`

**Causa:** La DB de test no está corriendo o no existe la base de datos `project_shop_test`.

**Solución:**
```bash
# 1. Levantar la DB
docker-compose up db -d

# 2. Crear la base de datos de test si no existe
docker exec -it project-shop-db psql -U postgres -c "CREATE DATABASE project_shop_test;"
```

---

### `npm run lint` falla con errores de TypeScript

**Síntoma:** Errores de `no-unsafe-assignment` o `unbound-method`

**Causa:** El proyecto usa `@typescript-eslint/recommended-type-checked` que ejecuta el compilador de TypeScript para detectar usos inseguros de `any`.

**Solución:** Corré `npm run lint` localmente antes de pushear para detectar errores antes del CI.

---

### Email no llega al registrar un usuario

**Causa:** El SMTP no está configurado o las credenciales son incorrectas.

**Nota:** El error de email NO bloquea el registro. El usuario se crea igualmente. El email es fire-and-forget.

**Para debugging:** Verificá los logs del servidor; el error aparece como `Welcome email failed for user <id>`.
