FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV NPM_CONFIG_LOGLEVEL=error \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --no-fund --no-audit

COPY tsconfig.json ./
COPY src ./src

RUN npm run db:generate
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 999 nodejs
RUN adduser --system --uid 999 penstream

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

USER penstream

EXPOSE 3000

CMD ["node", "dist/index.js"]
