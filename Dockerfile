# ─────────────────────────────────────────────────────────────────────────────
# STAGE 1: deps
# Instala SOLO las dependencias de producción.
# Al separarlo en su propio stage evitamos incluir devDependencies en la
# imagen final, lo que la hace considerablemente más liviana.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2: builder
# Compila TypeScript → JavaScript usando todas las dependencias (incluye dev).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 3: production
# Imagen final. Solo contiene:
#   - El runtime de Node (alpine = ~5 MB base)
#   - Las dependencias de producción (del stage "deps")
#   - El código compilado (dist/) del stage "builder"
# No incluye: código fuente TypeScript, devDependencies, ni la CLI de NestJS.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Usuario no-root: práctica de seguridad estándar en producción
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copiamos solo lo que necesitamos de los stages anteriores
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist

# Cambiamos al usuario sin privilegios
USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]
