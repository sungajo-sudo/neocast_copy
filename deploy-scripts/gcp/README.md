# Scripts

로컬 개발 환경 및 배포 스크립트 모음

---

## 로컬 개발 환경

### local-dev.sh

로컬 개발을 위한 Docker 컨테이너(PostgreSQL, Redis, GCS 에뮬레이터) 관리 스크립트

```bash
./scripts/local-dev.sh [command]
```

#### 명령어

| 명령어 | 설명 |
|--------|------|
| `up` | 컨테이너 시작 (기본값) |
| `down` | 컨테이너 중지 및 제거 |
| `restart` | 컨테이너 재시작 |
| `status` | 컨테이너 상태 확인 |
| `logs [service]` | 컨테이너 로그 출력 |
| `reset` | 데이터 볼륨 포함 전체 초기화 |
| `db-push` | Prisma 스키마를 DB에 적용 |
| `db-studio` | Prisma Studio 실행 |
| `init-gcs` | GCS 에뮬레이터 버킷 초기화 |
| `shell` | PostgreSQL 쉘 접속 |

#### 실행되는 서비스

| 서비스 | 이미지 | 포트 | 설명 |
|--------|--------|------|------|
| PostgreSQL | postgres:17-alpine | 5432 | 데이터베이스 |
| Redis | redis:7-alpine | 6379 | 캐시/세션 |
| GCS Emulator | fsouza/fake-gcs-server:1.49 | 4443 | 파일 스토리지 |

#### 빠른 시작

```bash
# 1. 컨테이너 시작
./scripts/local-dev.sh up

# 2. Server/.env 설정 (자동 출력되는 값 복사)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/penstreamdb"
REDIS_URL="redis://localhost:6379"
STORAGE_TYPE=gcs
GCS_PROJECT_ID=neocast-local
GCS_BUCKET_PREFIX=neocast-dev
GCS_EMULATOR_HOST=http://localhost:4443

# 3. Prisma 스키마 적용
./scripts/local-dev.sh db-push

# 4. 서버 실행
cd Server && npm run dev
```

#### 생성되는 Docker 리소스

스크립트 최초 실행 시 `docker/docker-compose.local.yml` 파일이 자동 생성됩니다.

볼륨:
- `neocast-dev-postgres`: PostgreSQL 데이터
- `neocast-dev-redis`: Redis 데이터
- `neocast-dev-gcs`: GCS 에뮬레이터 데이터

GCS 버킷 (자동 생성):
- `neocast-dev-files`: 채팅 파일 첨부
- `neocast-dev-papers`: NCode PDF/NPROJ

---

## 배포 스크립트

### deploy.sh

Cloud Run 서비스 배포 스크립트

```bash
./scripts/deploy.sh [all|web|admin|api]
```

| 인수 | 설명 |
|------|------|
| `all` | 전체 배포 (기본값) |
| `web` | 웹 클라이언트만 배포 |
| `admin` | Admin UI만 배포 |
| `api` | API 서버만 배포 |

### 주요 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PROJECT_ID` | livecast-484008 | GCP 프로젝트 ID |
| `REGION` | asia-northeast3 | 배포 리전 |
| `IMAGE_TAG` | YYYYMMDDHHmm | 이미지 태그 |

## deploy_db.sh

Prisma 스키마를 원격 PostgreSQL에 적용

```bash
./scripts/deploy_db.sh
```

Cloud SQL Proxy를 자동으로 시작하고, `prisma migrate diff`로 스키마 변경사항을 감지하여 적용합니다.

### 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `USE_PROXY` | 1 | Cloud SQL Proxy 사용 여부 |
| `DATABASE_URL` | - | 직접 DB URL 지정 시 사용 |

## 단축 스크립트

| 스크립트 | 동작 |
|----------|------|
| `deploy_web.sh` | `deploy.sh web`과 동일 |
| `deploy_admin.sh` | `deploy.sh admin`과 동일 |
| `deploy_api.sh` | `deploy.sh api`와 동일 |

## provision-gcp-infra.sh

GCP 인프라 프로비저닝 스크립트. 새 프로젝트 설정 또는 인프라 이전 시 사용합니다.

```bash
./scripts/provision-gcp-infra.sh [options]
```

### 생성되는 리소스

| 리소스 | 이름 (기본값) | 설명 |
|--------|--------------|------|
| VPC Connector | livecast-connector | Cloud Run → VPC 연결 |
| Cloud SQL | livecast-postgres | PostgreSQL 17 |
| Redis | livecast-redis | Memorystore Redis 7.2 |
| GCS Bucket | neocast-prod-files | 채팅 파일 첨부 |
| GCS Bucket | neocast-prod-papers | NCode PDF/NPROJ |
| Service Account | livecast-runner | Cloud Run 실행용 |
| Secret | livecast-jwt-secret | JWT 시크릿 |
| Artifact Registry | penstream | 컨테이너 이미지 저장소 |

### 옵션

| 옵션 | 설명 |
|------|------|
| `--dry-run` | 명령어만 출력, 실제 실행하지 않음 |
| `--skip-sql` | Cloud SQL 생성 건너뛰기 |
| `--skip-redis` | Redis 생성 건너뛰기 |
| `--skip-gcs` | GCS 버킷 생성 건너뛰기 |

### 주요 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PROJECT_ID` | livecast-484008 | GCP 프로젝트 ID |
| `REGION` | asia-northeast3 | 리전 |
| `SQL_TIER` | db-perf-optimized-N-8 | Cloud SQL 머신 타입 |
| `REDIS_MEMORY_SIZE` | 8 | Redis 메모리 (GB) |
| `GCS_BUCKET_PREFIX` | neocast-prod | 버킷 이름 prefix |

### 예시

```bash
# 전체 인프라 프로비저닝
./scripts/provision-gcp-infra.sh

# dry-run 모드로 명령어만 확인
./scripts/provision-gcp-infra.sh --dry-run

# 다른 프로젝트에 배포
PROJECT_ID=my-new-project ./scripts/provision-gcp-infra.sh

# GCS만 생성
./scripts/provision-gcp-infra.sh --skip-sql --skip-redis
```

### OCI 이전 참고사항

이 스크립트는 GCP 전용입니다. OCI로 이전 시 다음 매핑을 참고하세요:

| GCP 서비스 | OCI 대응 서비스 |
|-----------|-----------------|
| Cloud SQL (PostgreSQL) | OCI Database, Autonomous Database |
| Memorystore (Redis) | OCI Cache with Redis |
| Cloud Storage | OCI Object Storage |
| Cloud Run | OCI Container Instances, OKE |
| VPC Connector | OCI Service Gateway |
| Secret Manager | OCI Vault |
| Artifact Registry | OCI Container Registry |
