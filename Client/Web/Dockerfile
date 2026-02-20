FROM node:20-alpine AS builder

WORKDIR /app

ENV NPM_CONFIG_LOGLEVEL=error \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY package*.json ./
RUN npm ci --no-fund --no-audit

COPY . .

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM node:20-alpine

WORKDIR /app
RUN npm install -g serve

COPY --from=builder /app/dist ./dist

ENV PORT=8080
EXPOSE 8080

CMD ["serve", "-s", "dist", "-l", "8080"]
