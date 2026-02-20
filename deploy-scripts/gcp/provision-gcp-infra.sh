#!/usr/bin/env bash
#
# NeoCAST GCP Infrastructure Provisioning Script
#
# 이 스크립트는 NeoCAST 서비스에 필요한 GCP 인프라를 생성합니다.
# 프로젝트 이전 또는 새 환경 구성 시 참고용으로 사용합니다.
#
# 생성되는 리소스:
#   - VPC Serverless Access Connector
#   - Cloud SQL (PostgreSQL 17)
#   - Memorystore (Redis 7.2)
#   - Cloud Storage 버킷 (files, papers)
#   - Service Account 및 IAM 권한
#   - Secret Manager 시크릿
#
# 사용법:
#   ./provision-gcp-infra.sh [options]
#
# 옵션:
#   --dry-run     실제 실행하지 않고 명령어만 출력
#   --skip-sql    Cloud SQL 생성 건너뛰기
#   --skip-redis  Redis 생성 건너뛰기
#   --skip-gcs    GCS 버킷 생성 건너뛰기
#
# 환경변수로 설정값 오버라이드 가능:
#   PROJECT_ID, REGION, etc.
#
set -euo pipefail

# =============================================================================
# Configuration Variables
# =============================================================================

# GCP 프로젝트 설정
PROJECT_ID="${PROJECT_ID:-livecast-484008}"
REGION="${REGION:-asia-northeast3}"
ZONE="${ZONE:-${REGION}-a}"

# 네트워크 설정
VPC_NETWORK="${VPC_NETWORK:-default}"
VPC_CONNECTOR_NAME="${VPC_CONNECTOR_NAME:-livecast-connector}"
VPC_CONNECTOR_CIDR="${VPC_CONNECTOR_CIDR:-10.8.0.0/28}"
VPC_CONNECTOR_MIN_THROUGHPUT="${VPC_CONNECTOR_MIN_THROUGHPUT:-200}"
VPC_CONNECTOR_MAX_THROUGHPUT="${VPC_CONNECTOR_MAX_THROUGHPUT:-1000}"

# Cloud SQL (PostgreSQL) 설정
SQL_INSTANCE_NAME="${SQL_INSTANCE_NAME:-livecast-postgres}"
SQL_VERSION="${SQL_VERSION:-POSTGRES_17}"
SQL_TIER="${SQL_TIER:-db-perf-optimized-N-8}"  # 8 vCPU, 64GB RAM
SQL_DISK_SIZE="${SQL_DISK_SIZE:-100}"          # GB
SQL_DISK_TYPE="${SQL_DISK_TYPE:-PD_SSD}"
SQL_DB_NAME="${SQL_DB_NAME:-penstream}"
SQL_DB_USER="${SQL_DB_USER:-penstream}"
SQL_DB_PASSWORD="${SQL_DB_PASSWORD:-}"         # 빈 값이면 자동 생성

# Memorystore (Redis) 설정
REDIS_INSTANCE_NAME="${REDIS_INSTANCE_NAME:-livecast-redis}"
REDIS_VERSION="${REDIS_VERSION:-redis_7_2}"
REDIS_TIER="${REDIS_TIER:-BASIC}"              # BASIC 또는 STANDARD_HA
REDIS_MEMORY_SIZE="${REDIS_MEMORY_SIZE:-8}"    # GB

# Cloud Storage 설정
GCS_BUCKET_PREFIX="${GCS_BUCKET_PREFIX:-neocast-prod}"
GCS_LOCATION="${GCS_LOCATION:-${REGION}}"

# Service Account 설정
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-livecast-runner}"
SERVICE_ACCOUNT_DISPLAY="${SERVICE_ACCOUNT_DISPLAY:-LiveCAST Cloud Run}"

# Secret Manager 설정
JWT_SECRET_NAME="${JWT_SECRET_NAME:-livecast-jwt-secret}"

# Artifact Registry 설정
ARTIFACT_REPO="${ARTIFACT_REPO:-penstream}"
ARTIFACT_DESCRIPTION="${ARTIFACT_DESCRIPTION:-NeoCAST container images}"

# =============================================================================
# Helper Functions
# =============================================================================

DRY_RUN=0
SKIP_SQL=0
SKIP_REDIS=0
SKIP_GCS=0

log_info() {
  echo -e "\033[0;34m[INFO]\033[0m $*"
}

log_success() {
  echo -e "\033[0;32m[SUCCESS]\033[0m $*"
}

log_warn() {
  echo -e "\033[0;33m[WARN]\033[0m $*"
}

log_error() {
  echo -e "\033[0;31m[ERROR]\033[0m $*" >&2
}

run_cmd() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "  \$ $*"
  else
    "$@"
  fi
}

check_exists() {
  local type="$1"
  local name="$2"

  case "${type}" in
    sql)
      gcloud sql instances describe "${name}" --project="${PROJECT_ID}" >/dev/null 2>&1
      ;;
    redis)
      gcloud redis instances describe "${name}" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1
      ;;
    vpc-connector)
      gcloud compute networks vpc-access connectors describe "${name}" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1
      ;;
    bucket)
      gcloud storage buckets describe "gs://${name}" --project="${PROJECT_ID}" >/dev/null 2>&1
      ;;
    service-account)
      gcloud iam service-accounts describe "${name}@${PROJECT_ID}.iam.gserviceaccount.com" --project="${PROJECT_ID}" >/dev/null 2>&1
      ;;
    secret)
      gcloud secrets describe "${name}" --project="${PROJECT_ID}" >/dev/null 2>&1
      ;;
    artifact-repo)
      gcloud artifacts repositories describe "${name}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1
      ;;
  esac
}

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=1
      log_warn "Dry-run mode: commands will be printed but not executed"
      shift
      ;;
    --skip-sql)
      SKIP_SQL=1
      shift
      ;;
    --skip-redis)
      SKIP_REDIS=1
      shift
      ;;
    --skip-gcs)
      SKIP_GCS=1
      shift
      ;;
    -h|--help)
      head -30 "$0" | tail -28
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# =============================================================================
# Pre-flight Checks
# =============================================================================

log_info "Checking prerequisites..."

if ! command -v gcloud >/dev/null 2>&1; then
  log_error "gcloud CLI not found. Please install Google Cloud SDK."
  exit 1
fi

log_info "Setting project: ${PROJECT_ID}"
run_cmd gcloud config set project "${PROJECT_ID}"

echo ""
echo "=============================================="
echo " NeoCAST GCP Infrastructure Provisioning"
echo "=============================================="
echo ""
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Zone:     ${ZONE}"
echo ""

# =============================================================================
# 1. Enable Required APIs
# =============================================================================

log_info "Enabling required GCP APIs..."

REQUIRED_APIS=(
  "sqladmin.googleapis.com"          # Cloud SQL
  "redis.googleapis.com"             # Memorystore
  "storage.googleapis.com"           # Cloud Storage
  "vpcaccess.googleapis.com"         # VPC Serverless Access
  "secretmanager.googleapis.com"     # Secret Manager
  "artifactregistry.googleapis.com"  # Artifact Registry
  "run.googleapis.com"               # Cloud Run
  "cloudbuild.googleapis.com"        # Cloud Build
)

for api in "${REQUIRED_APIS[@]}"; do
  run_cmd gcloud services enable "${api}" --project="${PROJECT_ID}" --quiet
done

log_success "APIs enabled"

# =============================================================================
# 2. VPC Serverless Access Connector
# =============================================================================

echo ""
log_info "Creating VPC Serverless Access Connector..."

if check_exists vpc-connector "${VPC_CONNECTOR_NAME}"; then
  log_warn "VPC Connector '${VPC_CONNECTOR_NAME}' already exists, skipping"
else
  run_cmd gcloud compute networks vpc-access connectors create "${VPC_CONNECTOR_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --network="${VPC_NETWORK}" \
    --range="${VPC_CONNECTOR_CIDR}" \
    --min-throughput="${VPC_CONNECTOR_MIN_THROUGHPUT}" \
    --max-throughput="${VPC_CONNECTOR_MAX_THROUGHPUT}"
  log_success "VPC Connector created"
fi

# =============================================================================
# 3. Cloud SQL (PostgreSQL)
# =============================================================================

if [[ "${SKIP_SQL}" == "0" ]]; then
  echo ""
  log_info "Creating Cloud SQL instance (PostgreSQL)..."
  log_info "  Instance: ${SQL_INSTANCE_NAME}"
  log_info "  Version:  ${SQL_VERSION}"
  log_info "  Tier:     ${SQL_TIER}"
  log_info "  Disk:     ${SQL_DISK_SIZE}GB ${SQL_DISK_TYPE}"

  if check_exists sql "${SQL_INSTANCE_NAME}"; then
    log_warn "Cloud SQL instance '${SQL_INSTANCE_NAME}' already exists, skipping"
  else
    # Cloud SQL 인스턴스 생성 (시간이 오래 걸림)
    run_cmd gcloud sql instances create "${SQL_INSTANCE_NAME}" \
      --project="${PROJECT_ID}" \
      --region="${REGION}" \
      --database-version="${SQL_VERSION}" \
      --tier="${SQL_TIER}" \
      --storage-size="${SQL_DISK_SIZE}" \
      --storage-type="${SQL_DISK_TYPE}" \
      --storage-auto-increase \
      --availability-type=zonal \
      --backup-start-time=03:00 \
      --enable-bin-log \
      --maintenance-window-day=SUN \
      --maintenance-window-hour=04

    log_success "Cloud SQL instance created"
  fi

  # 데이터베이스 생성
  log_info "Creating database '${SQL_DB_NAME}'..."
  if run_cmd gcloud sql databases describe "${SQL_DB_NAME}" \
      --instance="${SQL_INSTANCE_NAME}" \
      --project="${PROJECT_ID}" >/dev/null 2>&1; then
    log_warn "Database '${SQL_DB_NAME}' already exists, skipping"
  else
    run_cmd gcloud sql databases create "${SQL_DB_NAME}" \
      --instance="${SQL_INSTANCE_NAME}" \
      --project="${PROJECT_ID}"
    log_success "Database created"
  fi

  # 사용자 생성
  log_info "Creating database user '${SQL_DB_USER}'..."
  if [[ -z "${SQL_DB_PASSWORD}" ]]; then
    SQL_DB_PASSWORD="$(openssl rand -base64 24 | tr -d '=/+')"
    log_warn "Generated random password for '${SQL_DB_USER}'"
    echo "  Password: ${SQL_DB_PASSWORD}"
    echo "  (Please save this securely!)"
  fi

  if run_cmd gcloud sql users describe "${SQL_DB_USER}" \
      --instance="${SQL_INSTANCE_NAME}" \
      --project="${PROJECT_ID}" >/dev/null 2>&1; then
    log_warn "User '${SQL_DB_USER}' already exists, skipping"
  else
    run_cmd gcloud sql users create "${SQL_DB_USER}" \
      --instance="${SQL_INSTANCE_NAME}" \
      --project="${PROJECT_ID}" \
      --password="${SQL_DB_PASSWORD}"
    log_success "Database user created"
  fi
else
  log_warn "Skipping Cloud SQL (--skip-sql)"
fi

# =============================================================================
# 4. Memorystore (Redis)
# =============================================================================

if [[ "${SKIP_REDIS}" == "0" ]]; then
  echo ""
  log_info "Creating Memorystore Redis instance..."
  log_info "  Instance: ${REDIS_INSTANCE_NAME}"
  log_info "  Version:  ${REDIS_VERSION}"
  log_info "  Tier:     ${REDIS_TIER}"
  log_info "  Memory:   ${REDIS_MEMORY_SIZE}GB"

  if check_exists redis "${REDIS_INSTANCE_NAME}"; then
    log_warn "Redis instance '${REDIS_INSTANCE_NAME}' already exists, skipping"
  else
    run_cmd gcloud redis instances create "${REDIS_INSTANCE_NAME}" \
      --project="${PROJECT_ID}" \
      --region="${REGION}" \
      --zone="${ZONE}" \
      --network="${VPC_NETWORK}" \
      --tier="${REDIS_TIER}" \
      --size="${REDIS_MEMORY_SIZE}" \
      --redis-version="${REDIS_VERSION}" \
      --connect-mode=DIRECT_PEERING

    log_success "Redis instance created"
  fi

  # Redis IP 출력
  if [[ "${DRY_RUN}" == "0" ]]; then
    REDIS_IP=$(gcloud redis instances describe "${REDIS_INSTANCE_NAME}" \
      --region="${REGION}" \
      --project="${PROJECT_ID}" \
      --format="value(host)" 2>/dev/null || echo "")
    if [[ -n "${REDIS_IP}" ]]; then
      log_info "Redis IP: ${REDIS_IP}"
      echo "  REDIS_URL=redis://${REDIS_IP}:6379"
    fi
  fi
else
  log_warn "Skipping Redis (--skip-redis)"
fi

# =============================================================================
# 5. Cloud Storage Buckets
# =============================================================================

if [[ "${SKIP_GCS}" == "0" ]]; then
  echo ""
  log_info "Creating Cloud Storage buckets..."

  BUCKETS=(
    "${GCS_BUCKET_PREFIX}-files:채팅 파일 첨부"
    "${GCS_BUCKET_PREFIX}-papers:NCode PDF/NPROJ 저장"
  )

  for bucket_info in "${BUCKETS[@]}"; do
    bucket_name="${bucket_info%%:*}"
    bucket_desc="${bucket_info##*:}"

    log_info "  Creating '${bucket_name}' (${bucket_desc})..."

    if check_exists bucket "${bucket_name}"; then
      log_warn "  Bucket '${bucket_name}' already exists, skipping"
    else
      run_cmd gcloud storage buckets create "gs://${bucket_name}" \
        --project="${PROJECT_ID}" \
        --location="${GCS_LOCATION}" \
        --uniform-bucket-level-access \
        --public-access-prevention
      log_success "  Bucket created"
    fi
  done
else
  log_warn "Skipping GCS buckets (--skip-gcs)"
fi

# =============================================================================
# 6. Service Account
# =============================================================================

echo ""
log_info "Creating Service Account..."

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if check_exists service-account "${SERVICE_ACCOUNT_NAME}"; then
  log_warn "Service account '${SERVICE_ACCOUNT_NAME}' already exists, skipping creation"
else
  run_cmd gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="${SERVICE_ACCOUNT_DISPLAY}"
  log_success "Service account created"
fi

# IAM 역할 부여
log_info "Granting IAM roles to service account..."

IAM_ROLES=(
  "roles/cloudsql.client"           # Cloud SQL 연결
  "roles/secretmanager.secretAccessor"  # Secret Manager 읽기
  "roles/vpcaccess.user"            # VPC Connector 사용
)

for role in "${IAM_ROLES[@]}"; do
  run_cmd gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="${role}" \
    --condition=None \
    --quiet
done

# GCS 버킷 권한 (개별 버킷에 objectAdmin)
if [[ "${SKIP_GCS}" == "0" ]]; then
  for bucket_info in "${BUCKETS[@]}"; do
    bucket_name="${bucket_info%%:*}"
    run_cmd gcloud storage buckets add-iam-policy-binding "gs://${bucket_name}" \
      --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
      --role="roles/storage.objectAdmin" \
      --quiet
  done
fi

log_success "IAM roles granted"

# =============================================================================
# 7. Secret Manager
# =============================================================================

echo ""
log_info "Creating Secret Manager secrets..."

if check_exists secret "${JWT_SECRET_NAME}"; then
  log_warn "Secret '${JWT_SECRET_NAME}' already exists, skipping"
else
  # JWT 시크릿 생성 (초기값은 랜덤)
  JWT_SECRET_VALUE="$(openssl rand -base64 48)"

  run_cmd gcloud secrets create "${JWT_SECRET_NAME}" \
    --project="${PROJECT_ID}" \
    --replication-policy="automatic"

  if [[ "${DRY_RUN}" == "0" ]]; then
    echo -n "${JWT_SECRET_VALUE}" | gcloud secrets versions add "${JWT_SECRET_NAME}" \
      --project="${PROJECT_ID}" \
      --data-file=-
  fi

  log_success "Secret created"
  log_warn "JWT Secret value: ${JWT_SECRET_VALUE}"
  echo "  (Please save this securely!)"
fi

# =============================================================================
# 8. Artifact Registry
# =============================================================================

echo ""
log_info "Creating Artifact Registry repository..."

if check_exists artifact-repo "${ARTIFACT_REPO}"; then
  log_warn "Artifact Registry '${ARTIFACT_REPO}' already exists, skipping"
else
  run_cmd gcloud artifacts repositories create "${ARTIFACT_REPO}" \
    --project="${PROJECT_ID}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="${ARTIFACT_DESCRIPTION}"
  log_success "Artifact Registry created"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "=============================================="
echo " Provisioning Complete"
echo "=============================================="
echo ""
echo "Resources created in project: ${PROJECT_ID}"
echo ""
echo "Cloud SQL:"
echo "  Instance:    ${SQL_INSTANCE_NAME}"
echo "  Connection:  ${PROJECT_ID}:${REGION}:${SQL_INSTANCE_NAME}"
echo "  Database:    ${SQL_DB_NAME}"
echo "  User:        ${SQL_DB_USER}"
echo ""
echo "Redis:"
echo "  Instance:    ${REDIS_INSTANCE_NAME}"
if [[ -n "${REDIS_IP:-}" ]]; then
echo "  Host:        ${REDIS_IP}"
echo "  URL:         redis://${REDIS_IP}:6379"
fi
echo ""
echo "GCS Buckets:"
echo "  Files:       gs://${GCS_BUCKET_PREFIX}-files"
echo "  Papers:      gs://${GCS_BUCKET_PREFIX}-papers"
echo ""
echo "VPC Connector: ${VPC_CONNECTOR_NAME}"
echo "Service Account: ${SERVICE_ACCOUNT_EMAIL}"
echo "JWT Secret: ${JWT_SECRET_NAME}"
echo "Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}"
echo ""
echo "Next steps:"
echo "  1. Update deploy.sh with the correct values"
echo "  2. Run: ./scripts/deploy.sh"
echo ""
