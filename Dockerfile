# syntax=docker/dockerfile:1

# ---- deps: install everything needed to build ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate the Prisma client and build Next ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate only reads the schema, it does not connect. The URL just has to parse.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
ARG NEXT_DEPLOYMENT_ID
# A fresh release gets a unique ID so open tabs can detect a deployment change.
RUN NEXT_DEPLOYMENT_ID="${NEXT_DEPLOYMENT_ID:-$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')}" npm run build
# Bundle the seed into one file so the runtime image can load reference data without tsx or the
# full node_modules (the standalone output does not include the Prisma driver adapter).
RUN npx esbuild prisma/seed.ts --bundle --platform=node --format=esm --tsconfig=tsconfig.json --external:pg-native --banner:js="import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" --outfile=seed.mjs

# ---- migrator tooling: Prisma CLI only, kept out of the app bundle ----
FROM node:22-bookworm-slim AS migrator
WORKDIR /opt/migrate
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm init -y >/dev/null && npm i --no-audit --no-fund prisma@7.10.1 dotenv
COPY prisma.config.ts ./
COPY prisma ./prisma
# Warm the schema engine download so the container does not need internet at start.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma --version

# ---- runner ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/seed.mjs ./seed.mjs
COPY --from=builder --chown=nextjs:nodejs /app/prisma/seed ./prisma/seed
COPY --from=migrator --chown=nextjs:nodejs /opt/migrate /opt/migrate
COPY --from=migrator --chown=nextjs:nodejs /root/.cache /home/nextjs/.cache
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
