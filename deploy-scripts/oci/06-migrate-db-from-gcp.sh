#!/bin/bash
# =============================================================================
# NeoCAST - Migrate DB from GCP Cloud SQL to OCI PostgreSQL
#
# Flow:
#   1. Start Cloud SQL Proxy to GCP
#   2. pg_dump from GCP (data only, no schema - schema managed by Prisma)
#   3. Transfer dump to OCI server
#   4. Restore into OCI PostgreSQL container
#
# Prerequisites:
#   - cloud-sql-proxy installed
#   - gcloud auth configured
#   - psql & pg_dump installed locally
#   - OCI server accessible via SSH
#
# Usage:
#   ./06-migrate-db-from-gcp.sh [--schema-too]
#     --schema-too: Also dump/restore schema (default: data only)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

# --- GCP Configuration ---
GCP_INSTANCE_CONN="${GCP_INSTANCE_CONN:-livecast-484008:asia-northeast3:livecast-postgres}"
GCP_DB_NAME="${GCP_DB_NAME:-penstream}"
GCP_DB_USER="${GCP_DB_USER:-penstream}"
GCP_DB_PASSWORD="${GCP_DB_PASSWORD:-kkro1234}"
GCP_DB_HOST="127.0.0.1"
GCP_DB_PORT="${GCP_DB_PORT:-15432}"  # Use non-standard port to avoid conflicts

# --- OCI Configuration (from config.sh) ---
OCI_DB_NAME="${DB_NAME:-penstream}"

# --- Options ---
SCHEMA_TOO=0
if [[ "${1:-}" == "--schema-too" ]]; then
    SCHEMA_TOO=1
fi

# --- Temp files ---
DUMP_FILE=$(mktemp /tmp/neocast-db-dump-XXXXXX.sql)
PROXY_PID=""

cleanup() {
    if [[ -n "${PROXY_PID}" ]]; then
        kill "${PROXY_PID}" >/dev/null 2>&1 || true
        log_info "Cloud SQL Proxy stopped"
    fi
    rm -f "${DUMP_FILE}"
}
trap cleanup EXIT

# --- Prerequisite checks ---
for cmd in psql pg_dump cloud-sql-proxy; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log_error "Required command not found: $cmd"
        exit 1
    fi
done

# =============================================================================
# Step 1: Start Cloud SQL Proxy
# =============================================================================
log_info "Starting Cloud SQL Proxy..."
cloud-sql-proxy "${GCP_INSTANCE_CONN}" --port "${GCP_DB_PORT}" >/dev/null 2>&1 &
PROXY_PID=$!
sleep 3

# Verify proxy is working
if ! pg_isready -h "${GCP_DB_HOST}" -p "${GCP_DB_PORT}" -U "${GCP_DB_USER}" -d "${GCP_DB_NAME}" >/dev/null 2>&1; then
    log_error "Cannot connect to GCP Cloud SQL via proxy"
    exit 1
fi
log_success "Cloud SQL Proxy running (PID: ${PROXY_PID})"

# =============================================================================
# Step 2: Dump from GCP
# =============================================================================
GCP_DATABASE_URL="postgresql://${GCP_DB_USER}:${GCP_DB_PASSWORD}@${GCP_DB_HOST}:${GCP_DB_PORT}/${GCP_DB_NAME}"

if [[ "${SCHEMA_TOO}" == "1" ]]; then
    log_info "Dumping schema + data from GCP..."
    PGPASSWORD="${GCP_DB_PASSWORD}" pg_dump \
        -h "${GCP_DB_HOST}" -p "${GCP_DB_PORT}" \
        -U "${GCP_DB_USER}" -d "${GCP_DB_NAME}" \
        --clean --if-exists \
        --no-owner --no-privileges \
        -f "${DUMP_FILE}"
else
    log_info "Dumping data only from GCP (schema managed by Prisma)..."
    PGPASSWORD="${GCP_DB_PASSWORD}" pg_dump \
        -h "${GCP_DB_HOST}" -p "${GCP_DB_PORT}" \
        -U "${GCP_DB_USER}" -d "${GCP_DB_NAME}" \
        --data-only \
        --no-owner --no-privileges \
        --disable-triggers \
        -f "${DUMP_FILE}"
fi

DUMP_SIZE=$(du -h "${DUMP_FILE}" | cut -f1)
DUMP_LINES=$(wc -l < "${DUMP_FILE}")
log_success "Dump complete: ${DUMP_SIZE} (${DUMP_LINES} lines)"

# Quick sanity check
if [[ "${DUMP_LINES}" -lt 5 ]]; then
    log_error "Dump file seems too small. Check GCP connection."
    cat "${DUMP_FILE}"
    exit 1
fi

# =============================================================================
# Step 3: Transfer dump to OCI server
# =============================================================================
log_info "Transferring dump to OCI server..."
remote_copy "${DUMP_FILE}" "/tmp/neocast-db-dump.sql"
log_success "Dump transferred to OCI"

# =============================================================================
# Step 4: Restore into OCI PostgreSQL
# =============================================================================
log_info "Restoring dump into OCI PostgreSQL..."

# Get the DB credentials from the OCI .env file
remote_exec "cd ${DEPLOY_DIR} && \
    source <(grep -E '^DB_(USER|PASSWORD|NAME)=' .env) && \
    docker compose exec -T postgres psql \
        -U \"\${DB_USER:-penstream}\" \
        -d \"\${DB_NAME:-penstream}\" \
        -v ON_ERROR_STOP=0 \
        < /tmp/neocast-db-dump.sql && \
    rm -f /tmp/neocast-db-dump.sql"

log_success "Database restore complete!"

# =============================================================================
# Step 5: Verify
# =============================================================================
log_info "Verifying migration..."

COUNTS=$(remote_exec "cd ${DEPLOY_DIR} && \
    source <(grep -E '^DB_(USER|PASSWORD|NAME)=' .env) && \
    docker compose exec -T postgres psql \
        -U \"\${DB_USER:-penstream}\" \
        -d \"\${DB_NAME:-penstream}\" \
        -t -A -c \"
            SELECT 'users=' || count(*) FROM \\\"User\\\"
            UNION ALL
            SELECT 'sessions=' || count(*) FROM \\\"Session\\\"
            UNION ALL
            SELECT 'friendships=' || count(*) FROM \\\"Friendship\\\"
            UNION ALL
            SELECT 'ncode_allocs=' || count(*) FROM \\\"NcodeAllocation\\\"
            UNION ALL
            SELECT 'user_papers=' || count(*) FROM \\\"UserPaper\\\";
        \"")

echo ""
echo "============================================="
log_success "Migration Summary (OCI)"
echo "============================================="
echo "${COUNTS}" | while IFS='=' read -r table count; do
    printf "  %-20s %s\n" "${table}" "${count}"
done
echo "============================================="
echo ""
log_success "GCP → OCI database migration done!"
