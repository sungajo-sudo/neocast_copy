#!/usr/bin/env bash
#
# NeoCAST Local Development Environment
#
# 로컬 개발을 위한 Docker 컨테이너(PostgreSQL, Redis, GCS 에뮬레이터) 관리 스크립트
#
# 사용법:
#   ./scripts/local-dev.sh [command]
#
# 명령어:
#   up        컨테이너 시작 (기본값)
#   down      컨테이너 중지 및 제거
#   restart   컨테이너 재시작
#   status    컨테이너 상태 확인
#   logs      컨테이너 로그 출력
#   reset     데이터 볼륨 포함 전체 초기화
#   db-push   Prisma 스키마를 DB에 적용
#   db-studio Prisma Studio 실행
#   init-gcs  GCS 에뮬레이터 버킷 초기화
#   shell     PostgreSQL 쉘 접속
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker/docker-compose.local.yml"

# 색상 출력
log_info() { echo -e "\033[0;34m[INFO]\033[0m $*"; }
log_success() { echo -e "\033[0;32m[OK]\033[0m $*"; }
log_warn() { echo -e "\033[0;33m[WARN]\033[0m $*"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; }

# Docker Compose 명령어 래퍼
dc() {
  docker compose -f "${COMPOSE_FILE}" -p neocast-dev "$@"
}

# 컨테이너 시작
cmd_up() {
  log_info "Starting local development containers..."

  # docker-compose.local.yml이 없으면 생성
  if [[ ! -f "${COMPOSE_FILE}" ]]; then
    log_info "Creating docker-compose.local.yml..."
    create_compose_file
  fi

  dc up -d

  log_info "Waiting for services to be ready..."

  # PostgreSQL 대기
  local retries=30
  while ! docker exec neocast-postgres pg_isready -U postgres >/dev/null 2>&1; do
    retries=$((retries - 1))
    if [[ $retries -le 0 ]]; then
      log_error "PostgreSQL failed to start"
      exit 1
    fi
    sleep 1
  done
  log_success "PostgreSQL is ready"

  # Redis 대기
  retries=30
  while ! docker exec neocast-redis redis-cli ping >/dev/null 2>&1; do
    retries=$((retries - 1))
    if [[ $retries -le 0 ]]; then
      log_error "Redis failed to start"
      exit 1
    fi
    sleep 1
  done
  log_success "Redis is ready"

  # GCS 에뮬레이터 대기
  retries=30
  while ! curl -s http://localhost:4443/storage/v1/b >/dev/null 2>&1; do
    retries=$((retries - 1))
    if [[ $retries -le 0 ]]; then
      log_error "GCS emulator failed to start"
      exit 1
    fi
    sleep 1
  done
  log_success "GCS emulator is ready"

  # GCS 버킷 초기화
  cmd_init_gcs

  echo ""
  log_success "All services are running!"
  echo ""
  echo "Services:"
  echo "  PostgreSQL: localhost:5432 (postgres/postgres)"
  echo "  Redis:      localhost:6379"
  echo "  GCS:        http://localhost:4443"
  echo ""
  echo "Environment variables for .env:"
  echo '  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/penstreamdb"'
  echo '  REDIS_URL="redis://localhost:6379"'
  echo '  STORAGE_TYPE=gcs'
  echo '  GCS_PROJECT_ID=neocast-local'
  echo '  GCS_BUCKET_PREFIX=neocast-dev'
  echo '  GCS_EMULATOR_HOST=http://localhost:4443'
  echo ""
  echo "Next: cd Server && npm run dev"
}

# 컨테이너 중지
cmd_down() {
  log_info "Stopping containers..."
  dc down
  log_success "Containers stopped"
}

# 컨테이너 재시작
cmd_restart() {
  cmd_down
  cmd_up
}

# 상태 확인
cmd_status() {
  echo "Container Status:"
  echo ""
  dc ps
  echo ""

  # 각 서비스 상태 체크
  echo "Service Health:"

  if docker exec neocast-postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo "  PostgreSQL: ✓ Running"
  else
    echo "  PostgreSQL: ✗ Not running"
  fi

  if docker exec neocast-redis redis-cli ping >/dev/null 2>&1; then
    echo "  Redis:      ✓ Running"
  else
    echo "  Redis:      ✗ Not running"
  fi

  if curl -s http://localhost:4443/storage/v1/b >/dev/null 2>&1; then
    echo "  GCS:        ✓ Running"
  else
    echo "  GCS:        ✗ Not running"
  fi
  echo ""
}

# 로그 출력
cmd_logs() {
  local service="${1:-}"
  if [[ -n "${service}" ]]; then
    dc logs -f "${service}"
  else
    dc logs -f
  fi
}

# 전체 초기화 (볼륨 포함)
cmd_reset() {
  log_warn "This will delete all data (PostgreSQL, Redis, GCS). Continue? [y/N]"
  read -r confirm
  if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
    log_info "Cancelled"
    exit 0
  fi

  log_info "Stopping and removing containers with volumes..."
  dc down -v
  log_success "All data has been reset"

  log_info "Starting fresh containers..."
  cmd_up
}

# Prisma DB Push
cmd_db_push() {
  log_info "Applying Prisma schema to database..."
  cd "${ROOT_DIR}/Server"

  if [[ ! -f "node_modules/.bin/prisma" ]]; then
    log_error "Prisma not found. Run 'npm install' in Server directory first."
    exit 1
  fi

  npx prisma db push
  log_success "Schema applied"
}

# Prisma Studio
cmd_db_studio() {
  log_info "Starting Prisma Studio..."
  cd "${ROOT_DIR}/Server"
  npx prisma studio
}

# GCS 버킷 초기화
cmd_init_gcs() {
  log_info "Initializing GCS buckets..."

  local gcs_host="http://localhost:4443"
  local buckets=("neocast-dev-files" "neocast-dev-papers")

  for bucket in "${buckets[@]}"; do
    if curl -s "${gcs_host}/storage/v1/b/${bucket}" >/dev/null 2>&1; then
      log_info "  Bucket '${bucket}' already exists"
    else
      curl -s -X POST "${gcs_host}/storage/v1/b?project=neocast-local" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"${bucket}\"}" >/dev/null
      log_success "  Created bucket '${bucket}'"
    fi
  done
}

# PostgreSQL 쉘 접속
cmd_shell() {
  log_info "Connecting to PostgreSQL..."
  docker exec -it neocast-postgres psql -U postgres -d penstreamdb
}

# docker-compose.local.yml 생성
create_compose_file() {
  mkdir -p "$(dirname "${COMPOSE_FILE}")"
  cat > "${COMPOSE_FILE}" << 'EOF'
# NeoCAST Local Development Environment
#
# 사용법:
#   docker compose -f docker/docker-compose.local.yml up -d
#   또는
#   ./scripts/local-dev.sh up
#

services:
  # PostgreSQL Database
  postgres:
    image: postgres:17-alpine
    container_name: neocast-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: penstreamdb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: neocast-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # GCS Emulator (fake-gcs-server)
  gcs:
    image: fsouza/fake-gcs-server:1.49
    container_name: neocast-gcs
    restart: unless-stopped
    ports:
      - "4443:4443"
    volumes:
      - gcs_data:/data
    command: ["-scheme", "http", "-port", "4443", "-external-url", "http://localhost:4443"]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4443/storage/v1/b"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    name: neocast-dev-postgres
  redis_data:
    name: neocast-dev-redis
  gcs_data:
    name: neocast-dev-gcs
EOF
  log_success "Created ${COMPOSE_FILE}"
}

# 도움말
cmd_help() {
  cat << 'EOF'
NeoCAST Local Development Environment

사용법:
  ./scripts/local-dev.sh [command]

명령어:
  up        컨테이너 시작 (기본값)
  down      컨테이너 중지 및 제거
  restart   컨테이너 재시작
  status    컨테이너 상태 확인
  logs      컨테이너 로그 출력 (logs [service])
  reset     데이터 볼륨 포함 전체 초기화
  db-push   Prisma 스키마를 DB에 적용
  db-studio Prisma Studio 실행
  init-gcs  GCS 에뮬레이터 버킷 초기화
  shell     PostgreSQL 쉘 접속
  help      이 도움말 출력

예시:
  ./scripts/local-dev.sh up          # 컨테이너 시작
  ./scripts/local-dev.sh logs redis  # Redis 로그만 출력
  ./scripts/local-dev.sh reset       # 전체 초기화
EOF
}

# 메인
main() {
  local cmd="${1:-up}"
  shift || true

  case "${cmd}" in
    up)        cmd_up "$@" ;;
    down)      cmd_down "$@" ;;
    restart)   cmd_restart "$@" ;;
    status)    cmd_status "$@" ;;
    logs)      cmd_logs "$@" ;;
    reset)     cmd_reset "$@" ;;
    db-push)   cmd_db_push "$@" ;;
    db-studio) cmd_db_studio "$@" ;;
    init-gcs)  cmd_init_gcs "$@" ;;
    shell)     cmd_shell "$@" ;;
    help|-h|--help) cmd_help ;;
    *)
      log_error "Unknown command: ${cmd}"
      cmd_help
      exit 1
      ;;
  esac
}

main "$@"
