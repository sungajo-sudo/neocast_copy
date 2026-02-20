#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Usage: deploy.sh [all|web|admin|api]
# Default: all
TARGET="${1:-all}"

case "${TARGET}" in
  all)
    DEPLOY_WEB="${DEPLOY_WEB:-1}"
    DEPLOY_ADMIN="${DEPLOY_ADMIN:-1}"
    DEPLOY_SERVER="${DEPLOY_SERVER:-1}"
    ;;
  web)
    DEPLOY_WEB=1
    DEPLOY_ADMIN=0
    DEPLOY_SERVER=0
    ;;
  admin)
    DEPLOY_WEB=0
    DEPLOY_ADMIN=1
    DEPLOY_SERVER=0
    ;;
  api)
    DEPLOY_WEB=0
    DEPLOY_ADMIN=0
    DEPLOY_SERVER=1
    ;;
  *)
    echo "Usage: $0 [all|web|admin|api]" >&2
    exit 1
    ;;
esac

echo "Deploy target: ${TARGET} (web=${DEPLOY_WEB}, admin=${DEPLOY_ADMIN}, api=${DEPLOY_SERVER})"

PROJECT_ID="${PROJECT_ID:-livecast-484008}"
REGION="${REGION:-asia-northeast3}"
REPO="${REPO:-penstream}"
SERVICE_NAME="${SERVICE_NAME:-livecast-api}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M)}"
IMAGE="${IMAGE:-${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}:${IMAGE_TAG}}"
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-livecast-web}"
ADMIN_SERVICE_NAME="${ADMIN_SERVICE_NAME:-livecast-admin}"
WEB_IMAGE="${WEB_IMAGE:-${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${WEB_SERVICE_NAME}:${IMAGE_TAG}}"
ADMIN_IMAGE="${ADMIN_IMAGE:-${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${ADMIN_SERVICE_NAME}:${IMAGE_TAG}}"

SERVER_CONCURRENCY="${SERVER_CONCURRENCY:-20}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-80}"
ADMIN_CONCURRENCY="${ADMIN_CONCURRENCY:-80}"

INSTANCE_CONN="${INSTANCE_CONN:-livecast-484008:asia-northeast3:livecast-postgres}"
DB_USER="${DB_USER:-penstream}"
DB_PASSWORD="${DB_PASSWORD:-kkro1234}"
DB_NAME="${DB_NAME:-penstream}"
DATABASE_URL="${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?host=/cloudsql/${INSTANCE_CONN}}"

REDIS_IP="${REDIS_IP:-10.84.218.123}"
REDIS_URL="${REDIS_URL:-redis://${REDIS_IP}:6379}"

JWT_SECRET_NAME="${JWT_SECRET_NAME:-livecast-jwt-secret}"
VPC_CONNECTOR="${VPC_CONNECTOR:-livecast-connector}"
# 기본 CORS origins (Cloud Run 서비스 URL들)
DEFAULT_CORS_ORIGINS="https://livecast-web-37313415834.asia-northeast3.run.app,https://livecast-admin-37313415834.asia-northeast3.run.app,https://livecast-484008.web.app,https://livecast.neolab.net,,https://neocast.neolab.net,http://localhost:5174,http://localhost:3000,http://localhost:5173,http://localhost:5175,http://localhost:7190,http://localhost:7191,https://shimizu-demo.web.app"
CORS_ORIGINS="${CORS_ORIGINS:-${DEFAULT_CORS_ORIGINS}}"


WEB_DIR="${WEB_DIR:-${ROOT_DIR}/Client/Web}"
ADMIN_DIR="${ADMIN_DIR:-${ROOT_DIR}/Server/admin-ui}"

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_EMAIL:-livecast-runner@livecast-484008.iam.gserviceaccount.com}"
SERVICE_ACCOUNT_FLAGS=()
if [[ -n "${SERVICE_ACCOUNT_EMAIL}" ]]; then
  SERVICE_ACCOUNT_FLAGS=(--service-account "${SERVICE_ACCOUNT_EMAIL}")
fi

# Service account setup (run once):
# gcloud iam service-accounts create livecast-runner \
#   --display-name="NeoCAST Cloud Run"
# gcloud secrets add-iam-policy-binding livecast-jwt-secret \
#   --member="serviceAccount:livecast-runner@livecast-484008.iam.gserviceaccount.com" \
#   --role="roles/secretmanager.secretAccessor"
# gcloud projects add-iam-policy-binding livecast-484008 \
#   --member="serviceAccount:livecast-runner@livecast-484008.iam.gserviceaccount.com" \
#   --role="roles/cloudsql.client"
# gcloud projects add-iam-policy-binding livecast-484008 \
#   --member="serviceAccount:livecast-runner@livecast-484008.iam.gserviceaccount.com" \
#   --role="roles/vpcaccess.user"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

# Bump build number in package.json (major.minor.build-number format)
bump_build_number() {
  local pkg_file="$1"
  if [[ ! -f "${pkg_file}" ]]; then
    echo "Warning: package.json not found: ${pkg_file}" >&2
    return 1
  fi

  # Extract current version
  local current_version
  current_version=$(grep -o '"version": *"[^"]*"' "${pkg_file}" | head -1 | sed 's/"version": *"\([^"]*\)"/\1/')

  if [[ -z "${current_version}" ]]; then
    echo "Warning: Could not find version in ${pkg_file}" >&2
    return 1
  fi

  # Parse major.minor.build
  local major minor build
  IFS='.' read -r major minor build <<< "${current_version}"

  # Default build to 0 if not present or not a number
  if [[ -z "${build}" ]] || ! [[ "${build}" =~ ^[0-9]+$ ]]; then
    build=0
  fi

  # Increment build number
  build=$((build + 1))

  local new_version="${major}.${minor}.${build}"

  # Update package.json using sed (macOS compatible)
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/\"version\": *\"${current_version}\"/\"version\": \"${new_version}\"/" "${pkg_file}"
  else
    sed -i "s/\"version\": *\"${current_version}\"/\"version\": \"${new_version}\"/" "${pkg_file}"
  fi

  echo "  ${pkg_file##*/}: ${current_version} -> ${new_version}"
}

require_cmd gcloud

# Bump build numbers for all packages before deploy
echo "Bumping build numbers..."
SERVER_PKG="${ROOT_DIR}/Server/package.json"
WEB_PKG="${ROOT_DIR}/Client/Web/package.json"
ADMIN_PKG="${ROOT_DIR}/Server/admin-ui/package.json"

if [[ "${DEPLOY_SERVER}" == "1" ]]; then
  bump_build_number "${SERVER_PKG}"
fi
if [[ "${DEPLOY_WEB}" == "1" ]]; then
  bump_build_number "${WEB_PKG}"
fi
if [[ "${DEPLOY_ADMIN}" == "1" ]]; then
  bump_build_number "${ADMIN_PKG}"
fi

echo "Configuring gcloud project and region..."
gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud config set run/region "${REGION}" >/dev/null

fetch_service_url() {
  gcloud run services describe "$1" \
    --region "${REGION}" \
    --format="value(status.url)" 2>/dev/null || true
}

if ! gcloud secrets describe "${JWT_SECRET_NAME}" >/dev/null 2>&1; then
  echo "Secret not found: ${JWT_SECRET_NAME}" >&2
  echo "Create it in Secret Manager before deploying." >&2
  exit 1
fi

if ! gcloud artifacts repositories describe "${REPO}" --location "${REGION}" >/dev/null 2>&1; then
  echo "Creating Artifact Registry repo: ${REPO}"
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="PenStream images"
fi

if [[ -z "${CORS_ORIGINS}" ]]; then
  WEB_URL="$(fetch_service_url "${WEB_SERVICE_NAME}")"
  ADMIN_URL="$(fetch_service_url "${ADMIN_SERVICE_NAME}")"
  if [[ -n "${WEB_URL}" || -n "${ADMIN_URL}" ]]; then
    CORS_ORIGINS="${WEB_URL}"
    if [[ -n "${ADMIN_URL}" ]]; then
      CORS_ORIGINS="${CORS_ORIGINS}${CORS_ORIGINS:+,}${ADMIN_URL}"
    fi
  fi
fi

if [[ "${DEPLOY_SERVER}" == "1" ]]; then
  # DB 스키마 변경사항 적용
  echo "Checking for database schema changes..."
  "${SCRIPT_DIR}/deploy_db.sh"

  echo "Building and pushing image: ${IMAGE}"
  gcloud builds submit "${ROOT_DIR}/Server" \
    --config "${ROOT_DIR}/Server/docker/cloudbuild.yaml" \
    --substitutions _IMAGE="${IMAGE}"

  echo "Deploying Cloud Run service: ${SERVICE_NAME}"
  SERVER_ENV_FLAGS=(--set-env-vars "HOST=0.0.0.0,NODE_ENV=production,REDIS_URL=${REDIS_URL}")
  SERVER_ENV_FLAGS+=(--set-env-vars "DATABASE_URL=${DATABASE_URL}")
  SERVER_ENV_FLAGS+=(--set-env-vars "STORAGE_TYPE=gcs,GCS_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_PREFIX=neocast-prod")
  if [[ -n "${CORS_ORIGINS}" ]]; then
    CORS_ORIGINS="${CORS_ORIGINS#[}"
    CORS_ORIGINS="${CORS_ORIGINS%]}"
    if [[ "${CORS_ORIGINS}" == *","* ]]; then
      SERVER_ENV_FLAGS+=(--set-env-vars "^~^CORS_ORIGINS=${CORS_ORIGINS}")
    else
      SERVER_ENV_FLAGS+=(--set-env-vars "CORS_ORIGINS=${CORS_ORIGINS}")
    fi
  fi
  gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE}" \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --concurrency "${SERVER_CONCURRENCY}" \
    "${SERVER_ENV_FLAGS[@]}" \
    --set-secrets JWT_SECRET="${JWT_SECRET_NAME}:latest" \
    --add-cloudsql-instances "${INSTANCE_CONN}" \
    --vpc-connector "${VPC_CONNECTOR}" \
    "${SERVICE_ACCOUNT_FLAGS[@]}" \
    --timeout 3600 \
    --min-instances 1
fi

if [[ -z "${API_BASE_URL:-}" ]]; then
  SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format="value(status.url)")"
  API_BASE_URL="${SERVICE_URL}/api"
fi
echo "Using API base URL for web/admin builds: ${API_BASE_URL}"


if [[ "${DEPLOY_WEB}" == "1" ]]; then
  if [[ ! -f "${WEB_DIR}/Dockerfile" || ! -f "${WEB_DIR}/cloudbuild.yaml" ]]; then
    echo "Missing web build files in: ${WEB_DIR}" >&2
    exit 1
  fi

  # Create temp staging directory for web build (to include git submodule files)
  WEB_BUILD_DIR=$(mktemp -d)
  cleanup_web_build() { rm -rf "${WEB_BUILD_DIR}"; }
  trap cleanup_web_build EXIT

  echo "Preparing web build directory (resolving submodules)..."
  # Copy all web files except node_modules and dist
  rsync -a --exclude 'node_modules' --exclude 'dist' --exclude '.git' "${WEB_DIR}/" "${WEB_BUILD_DIR}/"

  # The submodule dir exists but may only have .git file pointing to parent
  # Re-copy the actual submodule content from the working tree
  if [[ -d "${WEB_DIR}/sub-modules/wasm-pdf-core/dist" ]]; then
    echo "  Copying wasm-pdf-core submodule files..."
    mkdir -p "${WEB_BUILD_DIR}/sub-modules/wasm-pdf-core"
    cp -R "${WEB_DIR}/sub-modules/wasm-pdf-core/"* "${WEB_BUILD_DIR}/sub-modules/wasm-pdf-core/"
    rm -f "${WEB_BUILD_DIR}/sub-modules/wasm-pdf-core/.git" 2>/dev/null || true
  fi

  # Create .gcloudignore to ensure all files are uploaded (override default gitignore behavior)
  # Note: Do NOT exclude dist/ because sub-modules/wasm-pdf-core/dist/ contains required files
  cat > "${WEB_BUILD_DIR}/.gcloudignore" << 'GCIGNORE'
# Minimal ignore - only exclude obvious build artifacts
node_modules/
*.log
.DS_Store
# Exclude only root dist folder, not submodule dist
/dist/
GCIGNORE

  # Also remove any nested .gitignore files that might interfere with gcloud upload
  find "${WEB_BUILD_DIR}/sub-modules" -name ".gitignore" -delete 2>/dev/null || true

  # Debug: verify submodule files exist
  if [[ -f "${WEB_BUILD_DIR}/sub-modules/wasm-pdf-core/dist/js/main.js" ]]; then
    echo "  ✓ wasm-pdf-core main.js verified"
  else
    echo "  ✗ ERROR: wasm-pdf-core main.js not found in staging directory"
    ls -la "${WEB_BUILD_DIR}/sub-modules/" 2>/dev/null || true
    exit 1
  fi

  echo "Building and pushing web image: ${WEB_IMAGE}"
  gcloud builds submit "${WEB_BUILD_DIR}" \
    --config "${WEB_DIR}/cloudbuild.yaml" \
    --substitutions _IMAGE="${WEB_IMAGE}",_VITE_API_BASE_URL="${API_BASE_URL}"

  echo "Deploying Cloud Run service: ${WEB_SERVICE_NAME}"
  gcloud run deploy "${WEB_SERVICE_NAME}" \
    --image "${WEB_IMAGE}" \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --concurrency "${WEB_CONCURRENCY}" \
    --port 8080
fi

if [[ "${DEPLOY_ADMIN}" == "1" ]]; then
  if [[ ! -f "${ADMIN_DIR}/Dockerfile" || ! -f "${ADMIN_DIR}/cloudbuild.yaml" ]]; then
    echo "Missing admin build files in: ${ADMIN_DIR}" >&2
    exit 1
  fi

  echo "Building and pushing admin image: ${ADMIN_IMAGE}"
  gcloud builds submit "${ADMIN_DIR}" \
    --config "${ADMIN_DIR}/cloudbuild.yaml" \
    --substitutions _IMAGE="${ADMIN_IMAGE}",_VITE_API_BASE_URL="${API_BASE_URL}"

  echo "Deploying Cloud Run service: ${ADMIN_SERVICE_NAME}"
  gcloud run deploy "${ADMIN_SERVICE_NAME}" \
    --image "${ADMIN_IMAGE}" \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --concurrency "${ADMIN_CONCURRENCY}" \
    --port 8080
fi

echo "Done."
if [[ -z "${CORS_ORIGINS}" ]]; then
  echo "Note: CORS_ORIGINS is empty. Set it if your UI is on a different domain."
fi
if [[ "${DEPLOY_WEB}" == "1" || "${DEPLOY_ADMIN}" == "1" ]]; then
  echo "Next: configure HTTP(S) Load Balancer with path routing:"
  echo "- /api/* -> ${SERVICE_NAME}"
  echo "- /admin/* -> ${ADMIN_SERVICE_NAME}"
  echo "- / -> ${WEB_SERVICE_NAME}"
fi

echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting
