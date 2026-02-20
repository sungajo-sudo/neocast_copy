# DevOps 스크립트 추가 및 개선

## 변경 일자
2026-01-25

## 변경 요약
로컬 개발 환경 스크립트, GCP 인프라 프로비저닝 스크립트 추가 및 배포 스크립트 개선

## 변경 통계
- 신규 파일: 4개 (+938줄)
- 수정 파일: 4개 (+180줄, -65줄)

## 변경된 파일

### 신규 파일
- `scripts/local-dev.sh` (354줄): 로컬 개발 환경 Docker 컨테이너 관리 스크립트
- `scripts/provision-gcp-infra.sh` (517줄): GCP 인프라 프로비저닝 스크립트
- `docker/docker-compose.local.yml` (67줄): 로컬 개발용 Docker Compose 설정
- `updates/2026-01-25-deploy-scripts-update.md`: 이전 변경사항 문서

### 수정 파일
- `scripts/deploy.sh`: 폴더 경로 수정 + GCS 환경변수 추가
- `scripts/deploy_db.sh`: 폴더 경로 수정
- `scripts/README.md`: local-dev.sh, provision-gcp-infra.sh 문서 추가
- `Server/.env.example`: Production GCS 설정 예시 추가

## 상세 내용

### 1. 로컬 개발 환경 스크립트 (local-dev.sh)

Docker 컨테이너 관리 명령어:
- `up`: PostgreSQL, Redis, GCS 에뮬레이터 시작
- `down`: 컨테이너 중지
- `status`: 상태 확인
- `logs`: 로그 출력
- `reset`: 데이터 볼륨 포함 초기화
- `db-push`: Prisma 스키마 적용
- `db-studio`: Prisma Studio 실행
- `shell`: PostgreSQL 쉘 접속
- `init-gcs`: GCS 버킷 초기화

실행되는 서비스:
| 서비스 | 이미지 | 포트 |
|--------|--------|------|
| PostgreSQL | postgres:17-alpine | 5432 |
| Redis | redis:7-alpine | 6379 |
| GCS Emulator | fsouza/fake-gcs-server:1.49 | 4443 |

### 2. GCP 인프라 프로비저닝 스크립트 (provision-gcp-infra.sh)

생성되는 리소스:
- VPC Serverless Access Connector
- Cloud SQL (PostgreSQL 17)
- Memorystore (Redis 7.2)
- Cloud Storage 버킷
- Service Account 및 IAM 권한
- Secret Manager 시크릿
- Artifact Registry

옵션:
- `--dry-run`: 명령어만 출력
- `--skip-sql`: Cloud SQL 건너뛰기
- `--skip-redis`: Redis 건너뛰기
- `--skip-gcs`: GCS 건너뛰기

### 3. 배포 스크립트 개선

폴더명 변경 반영:
- `PenStreamServer` → `Server`
- `PenStreamClient` → `Client`

Production GCS 설정 추가:
- `STORAGE_TYPE=gcs`
- `GCS_PROJECT_ID=${PROJECT_ID}`
- `GCS_BUCKET_PREFIX=neocast-prod`

생성된 GCS 버킷:
- `neocast-prod-files` (채팅 파일)
- `neocast-prod-papers` (NCode PDF/NPROJ)
