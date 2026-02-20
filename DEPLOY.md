# Cloud Run 배포

이 저장소에는 `scripts/deploy.sh`가 포함되어 있으며, 아래 서비스를 빌드/배포합니다.

- API 서버: Cloud Run 서비스 `livecast-api`
- 웹 클라이언트: Cloud Run 서비스 `livecast-web`
- 어드민 UI: Cloud Run 서비스 `livecast-admin`

마이그레이션은 포함하지 않습니다.

## 빠른 시작

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## 선택 옵션

```bash
# web/admin 배포 생략
DEPLOY_WEB=0 DEPLOY_ADMIN=0 ./scripts/deploy.sh

# 서버(API) 배포 생략
DEPLOY_SERVER=0 ./scripts/deploy.sh

# API Base URL 직접 지정
API_BASE_URL="https://livecast-api-xxxx.asia-northeast3.run.app/api" ./scripts/deploy.sh

# CORS 적용 (livecast-web/admin만 허용)
CORS_ORIGINS="https://livecast-web-37313415834.asia-northeast3.run.app,https://livecast-admin-37313415834.asia-northeast3.run.app" \
DEPLOY_WEB=0 DEPLOY_ADMIN=0 ./scripts/deploy.sh
```

## DB 스키마 반영 (CLI)

`scripts/deploy_db.sh`는 로컬 Prisma 스키마를 기준으로 원격 DB에
필요한 SQL diff를 생성하고 적용합니다.

```bash
chmod +x scripts/deploy_db.sh
./scripts/deploy_db.sh
```

기본 동작:
- Cloud SQL Proxy로 접속 (localhost:5432)
- Prisma `migrate diff`로 SQL 생성
- `psql`로 적용

요구 사항:
- `psql`
- `cloud-sql-proxy`
- `gcloud`
- `PenStreamServer/node_modules`에 prisma CLI

옵션 예시:

```bash
# 프록시 없이 직접 접속
USE_PROXY=0 DB_HOST=34.64.134.209 ./scripts/deploy_db.sh

# DATABASE_URL을 직접 지정
DATABASE_URL="postgresql://penstream:kkro1234@127.0.0.1:5432/penstream" ./scripts/deploy_db.sh
```

## 기본 설정 값

스크립트 기본값(현재 NeoCAST 기준):

- `PROJECT_ID=livecast-484008`
- `REGION=asia-northeast3`
- `INSTANCE_CONN=livecast-484008:asia-northeast3:livecast-postgres`
- `REDIS_IP=10.84.218.123`
- `SERVICE_ACCOUNT_EMAIL=livecast-runner@livecast-484008.iam.gserviceaccount.com`

스크립트는 서버 배포 후 `livecast-api` 서비스 URL을 읽어
`API_BASE_URL`을 자동으로 설정합니다.

필요하면 실행 시 덮어쓸 수 있습니다.

```bash
PROJECT_ID=livecast-484008 \
REGION=asia-northeast3 \
CORS_ORIGINS="https://app.example.com,https://admin.example.com" \
./scripts/deploy.sh
```

## 참고

- API는 Cloud Run이 주입하는 `PORT`(8080)를 사용합니다. DB가 없으면 기동에 실패합니다.
- `DATABASE_URL`은 Prisma 호환을 위해 `localhost:5432` + Cloud SQL 소켓 경로를 사용합니다.
- `CORS_ORIGINS`는 UI와 API가 같은 도메인이면 비워도 됩니다.
- `run.app` 도메인은 서비스별로 분리되어 있습니다. `/api`, `/admin`을 한 도메인에 묶으려면 커스텀 도메인 + HTTP(S) 로드밸런서가 필요합니다.

자세한 설정은 아래 문서를 참고하세요.

- `docs/deploy/README.md`
- `docs/deploy/GCP_PREP.md`
- `docs/deploy/ENV_INFO.md`
