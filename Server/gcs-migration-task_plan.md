# Task Plan: GCS Storage Migration

## Goal
서버의 파일 스토리지를 로컬 파일시스템에서 Google Cloud Storage로 마이그레이션하여, 로컬 개발 시 Docker 에뮬레이터를 사용하고 프로덕션에서는 GCP Cloud Storage를 사용하도록 한다.

## Current Phase
Phase 1

## Phases

### Phase 1: Storage Provider 인터페이스 및 구현체 생성
- [ ] `storage/` 디렉토리 및 `storage-provider.interface.ts` 생성
- [ ] `local-storage.provider.ts` 구현
- [ ] `gcs-storage.provider.ts` 구현
- [ ] `storage/index.ts` (팩토리) 구현
- **Status:** pending

### Phase 2: 기존 서비스 리팩토링
- [ ] `file-storage.service.ts` - IStorageProvider 사용하도록 수정
- [ ] `nc-paperhub.service.ts` - IStorageProvider 사용하도록 수정
- **Status:** pending

### Phase 3: 인프라 설정
- [ ] `package.json`에 `@google-cloud/storage` 추가
- [ ] `docker-compose.yml`에 fake-gcs-server 추가
- [ ] `.env.example` 환경변수 추가
- [ ] `.env.production.example` 환경변수 추가
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] 로컬 모드 (`STORAGE_TYPE=local`) 테스트
- [ ] 에뮬레이터 모드 (`STORAGE_TYPE=gcs` + 에뮬레이터) 테스트
- [ ] API 엔드포인트 동작 확인
- **Status:** pending

## Key Questions
1. ~~가장 저렴한 스토리지 클래스는?~~ → Standard (자주 액세스되는 파일)
2. ~~로컬 개발 환경 에뮬레이터?~~ → fake-gcs-server

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Standard Storage 사용 | 파일 다운로드 빈도가 높아 검색 비용 고려 시 가장 경제적 |
| IStorageProvider 인터페이스 | 스토리지 백엔드를 환경변수로 교체 가능 |
| fake-gcs-server | 로컬 개발용 GCS 에뮬레이터로 실제 GCS API와 호환 |
| 버킷 분리 (files/papers) | 용도별 분리로 관리 용이 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (없음) | | |

## Notes
- 기존 로컬 파일 데이터 마이그레이션 스크립트는 별도 작업 필요
- GCS 버킷 CORS 설정은 프론트엔드 직접 접근 시 필요
