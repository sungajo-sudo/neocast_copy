# Findings: GCS Storage Migration

## Requirements
- 로컬 파일시스템을 GCS(Google Cloud Storage)로 마이그레이션
- 로컬 개발: Docker로 GCS 에뮬레이터 (fake-gcs-server)
- 프로덕션: 실제 GCP Cloud Storage
- 가장 저렴한 스토리지 클래스 사용

## 현재 스토리지 서비스 구조

### 1. FileStorageService (`file-storage.service.ts`)
- **경로**: `./storage/files` (환경변수: `FILE_STORAGE_PATH`)
- **용도**: 채팅 파일 첨부, 일반 파일 업로드
- **API**: `/api/files/*`
- **메타데이터**: `.meta.json` 파일로 저장

### 2. NcPaperHubService (`nc-paperhub.service.ts`)
- **경로**: `./storage/papers` (환경변수: `NC_PAPERHUB_STORAGE`)
- **용도**: NCode PDF + NPROJ 저장
- **API**: `/api/nc-paperhub/*`
- **메타데이터**: DB (UserPaper 테이블) + NPROJ XML 포함

## 디렉토리 구조
```
Server/storage/
├── files/           # fileStorageService
│   ├── {uuid}.{ext}
│   └── {uuid}.meta.json
└── papers/          # ncPaperHubService
    └── {userId}/
        ├── {paperGroupId}.pdf
        └── {paperGroupId}.nproj
```

## GCS 비용 분석

| 클래스 | 월/GB | 최소 보관 | 적합한 용도 |
|--------|-------|----------|-----------|
| Standard | $0.020 | 없음 | 자주 액세스 |
| Nearline | $0.010 | 30일 | 월 1회 미만 |
| Coldline | $0.004 | 90일 | 분기 1회 미만 |
| Archive | $0.0012 | 365일 | 연 1회 미만 |

**결론**: 채팅 파일은 자주 다운로드되므로 **Standard**가 적합.
Coldline/Archive는 검색 비용이 추가되어 오히려 비쌀 수 있음.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Standard Storage 사용 | 파일 다운로드 빈도가 높음. 검색 비용 고려 시 가장 경제적 |
| 환경변수로 전환 | `STORAGE_TYPE=local|gcs`로 로컬/GCS 전환 |
| fake-gcs-server 사용 | 로컬 개발용 GCS 에뮬레이터 |
| 추상화 레이어 도입 | IStorageProvider 인터페이스로 스토리지 백엔드 교체 가능 |

## Resources
- GCS Node.js 라이브러리: `@google-cloud/storage`
- fake-gcs-server Docker: `fsouza/fake-gcs-server`
- GCS 가격: https://cloud.google.com/storage/pricing

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| (없음) | |
