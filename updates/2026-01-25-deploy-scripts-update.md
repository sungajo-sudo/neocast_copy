# 배포 스크립트 업데이트 및 GCP 인프라 프로비저닝 스크립트 추가

## 변경 일자
2026-01-25

## 변경 요약
- 폴더명 변경(PenStreamServer→Server, PenStreamClient→Client) 반영
- Production GCS 버킷 생성 및 환경변수 설정 추가
- GCP 인프라 프로비저닝 스크립트 신규 작성

## 변경된 파일

### 수정된 파일
- `scripts/deploy.sh`: 폴더 경로 업데이트 + GCS 환경변수 추가
- `scripts/deploy_db.sh`: 폴더 경로 업데이트
- `scripts/README.md`: provision-gcp-infra.sh 문서 추가
- `Server/.env.example`: Production GCS 설정 예시 추가

### 신규 파일
- `scripts/provision-gcp-infra.sh`: GCP 인프라 프로비저닝 스크립트 (517줄)

## 상세 내용

### 1. 폴더명 변경 반영

`deploy.sh`와 `deploy_db.sh`에서 이전 폴더명을 새 폴더명으로 변경:

| 변경 전 | 변경 후 |
|---------|---------|
| `PenStreamServer` | `Server` |
| `PenStreamClient` | `Client` |

영향 받는 경로:
- `WEB_DIR`, `ADMIN_DIR`
- `SERVER_PKG`, `WEB_PKG`, `ADMIN_PKG`
- `gcloud builds submit` 경로
- `PRISMA_SCHEMA`, `PRISMA_BIN`

### 2. Production GCS 설정

생성된 GCS 버킷:
- `neocast-prod-files` (asia-northeast3): 채팅 파일 첨부
- `neocast-prod-papers` (asia-northeast3): NCode PDF/NPROJ 저장

`deploy.sh`에 추가된 환경변수:
```bash
STORAGE_TYPE=gcs
GCS_PROJECT_ID=${PROJECT_ID}
GCS_BUCKET_PREFIX=neocast-prod
```

### 3. GCP 인프라 프로비저닝 스크립트

새 프로젝트 설정 또는 OCI 이전 시 참고용 스크립트 작성.

생성되는 리소스:
| 리소스 | 이름 | 스펙 |
|--------|------|------|
| VPC Connector | livecast-connector | 10.8.0.0/28, 200-1000 Mbps |
| Cloud SQL | livecast-postgres | PostgreSQL 17, db-perf-optimized-N-8, 100GB SSD |
| Memorystore | livecast-redis | Redis 7.2, 8GB, BASIC tier |
| GCS Bucket | neocast-prod-files | asia-northeast3 |
| GCS Bucket | neocast-prod-papers | asia-northeast3 |
| Service Account | livecast-runner | Cloud Run 실행용 |
| Secret Manager | livecast-jwt-secret | JWT 시크릿 |
| Artifact Registry | penstream | 컨테이너 이미지 |

사용법:
```bash
# 전체 인프라 생성
./scripts/provision-gcp-infra.sh

# dry-run 모드
./scripts/provision-gcp-infra.sh --dry-run

# 다른 프로젝트에 배포
PROJECT_ID=my-project ./scripts/provision-gcp-infra.sh
```

### 4. OCI 이전 참고

README.md에 GCP → OCI 서비스 매핑 테이블 추가:
- Cloud SQL → OCI Database / Autonomous Database
- Memorystore → OCI Cache with Redis
- Cloud Storage → OCI Object Storage
- Cloud Run → OCI Container Instances / OKE
