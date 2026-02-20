#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PROJECT_ID="${PROJECT_ID:-livecast-484008}"
REGION="${REGION:-asia-northeast3}"
INSTANCE_CONN="${INSTANCE_CONN:-livecast-484008:asia-northeast3:livecast-postgres}"

DB_NAME="${DB_NAME:-penstream}"
DB_USER="${DB_USER:-penstream}"
DB_PASSWORD="${DB_PASSWORD:-kkro1234}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

USE_PROXY="${USE_PROXY:-1}"
PRISMA_SCHEMA="${PRISMA_SCHEMA:-${ROOT_DIR}/Server/prisma/schema.prisma}"
PRISMA_BIN="${PRISMA_BIN:-${ROOT_DIR}/Server/node_modules/.bin/prisma}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

cleanup() {
  if [[ -n "${PROXY_PID:-}" ]]; then
    kill "${PROXY_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${TMP_SQL:-}" && -f "${TMP_SQL}" ]]; then
    rm -f "${TMP_SQL}"
  fi
}

trap cleanup EXIT

require_cmd psql

if [[ ! -x "${PRISMA_BIN}" ]]; then
  if command -v npx >/dev/null 2>&1; then
    PRISMA_BIN="npx prisma"
  else
    echo "Prisma CLI not found. Install dependencies in Server." >&2
    exit 1
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ "${USE_PROXY}" == "1" ]]; then
    require_cmd gcloud
    require_cmd cloud-sql-proxy
    cloud-sql-proxy "${INSTANCE_CONN}" --port "${DB_PORT}" >/dev/null 2>&1 &
    PROXY_PID=$!
    sleep 2
    DB_HOST="127.0.0.1"
  fi

  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

if [[ ! -f "${PRISMA_SCHEMA}" ]]; then
  echo "Prisma schema not found: ${PRISMA_SCHEMA}" >&2
  exit 1
fi

TMP_SQL="$(mktemp)"

echo "Generating schema diff..."
if [[ "${PRISMA_BIN}" == npx* ]]; then
  (cd "${ROOT_DIR}/Server" && DATABASE_URL="${DATABASE_URL}" ${PRISMA_BIN} migrate diff \
    --from-url "${DATABASE_URL}" \
    --to-schema-datamodel "${PRISMA_SCHEMA}" \
    --script > "${TMP_SQL}")
else
  DATABASE_URL="${DATABASE_URL}" "${PRISMA_BIN}" migrate diff \
    --from-url "${DATABASE_URL}" \
    --to-schema-datamodel "${PRISMA_SCHEMA}" \
    --script > "${TMP_SQL}"
fi

if ! grep -Eq "CREATE|ALTER|DROP" "${TMP_SQL}"; then
  echo "No schema changes detected."
  exit 0
fi

echo "Applying schema diff to remote database..."
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${TMP_SQL}"

echo "Schema updated."
