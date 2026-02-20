#!/bin/bash
# =============================================================================
# NeoCAST - Deploy (local Docker build -> transfer -> restart -> healthcheck)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

if [ -z "$INSTANCE_PUBLIC_IP" ]; then
    log_error "INSTANCE_PUBLIC_IP is not set."
    exit 1
fi

# --- Argument parsing ---
TARGET="${1:-all}"
DEPLOY_API=0
DEPLOY_WEB=0
DEPLOY_ADMIN=0

case "$TARGET" in
    all)
        DEPLOY_API=1; DEPLOY_WEB=1; DEPLOY_ADMIN=1
        ;;
    api)
        DEPLOY_API=1
        ;;
    web)
        DEPLOY_WEB=1
        ;;
    admin)
        DEPLOY_ADMIN=1
        ;;
    *)
        echo "Usage: $0 [all|api|web|admin]" >&2
        exit 1
        ;;
esac

log_info "Deploy target: ${TARGET} (api=${DEPLOY_API}, web=${DEPLOY_WEB}, admin=${DEPLOY_ADMIN})"

# --- Temp directory for image tarballs ---
BUILD_DIR=$(mktemp -d)
cleanup() { rm -rf "$BUILD_DIR"; }
trap cleanup EXIT

# --- Build API image ---
if [ "$DEPLOY_API" = "1" ]; then
    log_info "Building API image..."
    docker build \
        --platform linux/arm64 \
        -t neocast-api:latest \
        -f "${PROJECT_ROOT}/Server/docker/Dockerfile" \
        "${PROJECT_ROOT}/Server"
    log_success "API image built"

    log_info "Saving API image..."
    docker save neocast-api:latest | gzip > "${BUILD_DIR}/neocast-api.tar.gz"
    API_SIZE=$(du -h "${BUILD_DIR}/neocast-api.tar.gz" | cut -f1)
    log_success "API image saved (${API_SIZE})"
fi

# --- Build Web image ---
if [ "$DEPLOY_WEB" = "1" ]; then
    WEB_DIR="${PROJECT_ROOT}/Client/Web"

    # Bump patch version (e.g. 1.1.8 → 1.1.9)
    OLD_VER=$(node -p "require('${WEB_DIR}/package.json').version")
    (cd "${WEB_DIR}" && npm version patch --no-git-tag-version > /dev/null)
    NEW_VER=$(node -p "require('${WEB_DIR}/package.json').version")
    log_info "Web version bumped: ${OLD_VER} → ${NEW_VER}"

    log_info "Preparing Web build context (resolving submodules)..."
    WEB_BUILD_CONTEXT=$(mktemp -d)

    # Copy all web files except node_modules and dist
    rsync -a --exclude 'node_modules' --exclude 'dist' --exclude '.git' \
        "${WEB_DIR}/" "${WEB_BUILD_CONTEXT}/"

    # Copy submodule content (git submodule may only have .git pointer)
    if [ -d "${WEB_DIR}/sub-modules/wasm-pdf-core/dist" ]; then
        log_info "  Copying wasm-pdf-core submodule files..."
        mkdir -p "${WEB_BUILD_CONTEXT}/sub-modules/wasm-pdf-core"
        cp -R "${WEB_DIR}/sub-modules/wasm-pdf-core/"* "${WEB_BUILD_CONTEXT}/sub-modules/wasm-pdf-core/"
        rm -f "${WEB_BUILD_CONTEXT}/sub-modules/wasm-pdf-core/.git" 2>/dev/null || true
    fi

    # Remove nested .gitignore that may interfere
    find "${WEB_BUILD_CONTEXT}/sub-modules" -name ".gitignore" -delete 2>/dev/null || true

    log_info "Building Web image..."
    docker build \
        --platform linux/arm64 \
        --build-arg VITE_API_BASE_URL=/api \
        -t neocast-web:latest \
        "${WEB_BUILD_CONTEXT}"

    rm -rf "${WEB_BUILD_CONTEXT}"
    log_success "Web image built"

    log_info "Saving Web image..."
    docker save neocast-web:latest | gzip > "${BUILD_DIR}/neocast-web.tar.gz"
    WEB_SIZE=$(du -h "${BUILD_DIR}/neocast-web.tar.gz" | cut -f1)
    log_success "Web image saved (${WEB_SIZE})"
fi

# --- Build Admin image ---
if [ "$DEPLOY_ADMIN" = "1" ]; then
    log_info "Building Admin image..."
    docker build \
        --platform linux/arm64 \
        --build-arg VITE_API_BASE_URL=/api \
        --build-arg VITE_BASE_PATH=/admin/ \
        -t neocast-admin:latest \
        "${PROJECT_ROOT}/Server/admin-ui"
    log_success "Admin image built"

    log_info "Saving Admin image..."
    docker save neocast-admin:latest | gzip > "${BUILD_DIR}/neocast-admin.tar.gz"
    ADMIN_SIZE=$(du -h "${BUILD_DIR}/neocast-admin.tar.gz" | cut -f1)
    log_success "Admin image saved (${ADMIN_SIZE})"
fi

# --- Transfer images to server ---
log_info "Transferring images to server..."
for img_file in "${BUILD_DIR}"/*.tar.gz; do
    [ -f "$img_file" ] || continue
    IMG_NAME=$(basename "$img_file")
    log_info "  Uploading ${IMG_NAME}..."
    remote_copy "$img_file" "/tmp/${IMG_NAME}"
    log_info "  Loading ${IMG_NAME} on server..."
    remote_exec "docker load < /tmp/${IMG_NAME} && rm -f /tmp/${IMG_NAME}"
done
log_success "All images transferred and loaded"

# --- Sync docker-compose.yml ---
log_info "Syncing docker-compose.yml..."
remote_copy "${SCRIPT_DIR}/docker-compose.prod.yml" "${DEPLOY_DIR}/docker-compose.yml"

# --- Sync .env file (OCI credentials) ---
if [ -f "${DEPLOY_DIR}/.env" ] 2>/dev/null || remote_exec "test -f ${DEPLOY_DIR}/.env" 2>/dev/null; then
    log_info ".env file exists on server"
else
    # Generate and upload .env if not present
    OCI_API_KEY_DIR="${SCRIPT_DIR}/.oci-keys"
    if [ -f "$OCI_API_KEY_DIR/app_api_key.pem" ]; then
        OCI_PRIVATE_KEY_ONELINE=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' "$OCI_API_KEY_DIR/app_api_key.pem")
        ENV_FILE=$(mktemp)
        cat > "$ENV_FILE" <<ENVEOF
# Generated by 05-deploy.sh at $(date -u +"%Y-%m-%dT%H:%M:%SZ")
DB_USER=penstream
DB_PASSWORD=$(openssl rand -hex 24)
DB_NAME=penstream
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=https://${APP_DOMAIN},https://neocast-dev.neolab.net
LOG_LEVEL=info
OCI_BUCKET_PREFIX=${OCI_BUCKET_PREFIX:-neocast}
OCI_COMPARTMENT_ID=${OCI_COMPARTMENT_OCID}
OCI_REGION=${OCI_REGION}
OCI_NAMESPACE=${OCI_NAMESPACE:-}
OCI_TENANCY_ID=${OCI_TENANCY_OCID}
OCI_USER_ID=${OCI_APP_USER_OCID:-}
OCI_FINGERPRINT=${OCI_APP_FINGERPRINT:-}
OCI_PRIVATE_KEY=${OCI_PRIVATE_KEY_ONELINE}
OCI_PASSPHRASE=
NDP_LICENSE_KEY=
NDP_API_URL=
ENVEOF
        remote_copy "$ENV_FILE" "${DEPLOY_DIR}/.env"
        rm -f "$ENV_FILE"
        log_success ".env file generated and deployed"
    else
        log_warn "No .env on server and no API key found locally. Skipping .env sync."
    fi
fi

# --- Restart services ---
log_info "Restarting services..."
remote_exec "cd ${DEPLOY_DIR} && docker compose up -d --remove-orphans"
log_success "Services restarted"

# --- DB migration (on API deploy) ---
if [ "$DEPLOY_API" = "1" ]; then
    log_info "Running database migration..."
    remote_exec "cd ${DEPLOY_DIR} && docker compose exec -T api npx prisma db push --skip-generate" || {
        log_warn "DB migration failed or not needed. Check manually."
    }
fi

# --- Health check ---
log_info "Waiting for health check (max 90s)..."
HEALTH_URL="https://${APP_DOMAIN}/health"

for i in $(seq 1 18); do
    sleep 5
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "Health check passed! (attempt ${i}, $((i * 5))s)"
        echo ""
        echo "============================================="
        log_success "Deploy complete!"
        echo "============================================="
        echo ""
        echo "  App:    https://${APP_DOMAIN}"
        echo "  Admin:  https://${APP_DOMAIN}/admin/"
        echo "  Health: https://${APP_DOMAIN}/health"
        echo ""
        exit 0
    fi
    echo "  ... waiting ($((i * 5))s, HTTP ${HTTP_CODE})"
done

log_warn "Health check timeout (90s)"
echo ""
echo "Check service logs:"
echo "  ssh -i ${SSH_PRIVATE_KEY_PATH} -p ${SSH_PORT} ${SSH_USER}@${INSTANCE_PUBLIC_IP}"
echo "  cd ${DEPLOY_DIR} && docker compose logs --tail=50"
exit 1
