# Task Plan: NCode Publish & Local PaperHub Implementation

## Goal
PDF에 NCode를 부여하고 로컬 IndexedDB에 저장하는 기능을 구현하여, 서버 없이도 NCode PDF를 생성하고 관리할 수 있도록 한다.

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [x] 기존 paper-info.service.ts 구조 분석
- [x] wasm-pdf-core NCode 삽입 기능 분석 (NcodeLayer, NeoPDFPage.addNcodeLayer)
- [x] 서버 paper-register API 구조 분석 (nproj-generator.service.ts)
- [x] shimizu-2026 NcodePublish.tsx 현재 상태 확인
- [x] 타입 정의 확인 (paper-info.ts)
- **Status:** complete

### Phase 2: Local PaperHub IndexedDB 구현 (WebNeoSmartpen)
- [ ] IndexedDB 스키마 설계
  - papers: SOB 단위 paper 정보 (nproj, pdf blob)
  - ncodeAllocation: NCode 할당 테이블 (section, owner, book 관리)
- [ ] local-paperhub.service.ts 생성
  - LocalPaperHubService class
  - IndexedDB CRUD 함수
- [ ] paper-register 로직 구현 (로컬용)
  - NCode 할당 함수
  - NPROJ 생성 함수 (클라이언트용)
  - PDF + NPROJ 저장 함수
- [ ] paper-info 로직 구현 (로컬용)
  - SOB로 paper 조회
  - 서버 API와 동일한 응답 형식
- **Status:** pending

### Phase 3: Paper Info Service 래퍼 구현 (WebNeoSmartpen)
- [ ] paper-info.service.ts 수정
  - Local PaperHub 우선 조회
  - 없으면 서버 API 폴백
- [ ] paper-register 래퍼 함수 추가
  - init config에 따라 로컬/서버 선택
  - 기본값: 로컬
- [ ] 타입 정의 업데이트
- **Status:** pending

### Phase 4: NCode Publish 페이지 구현 (shimizu-2026)
- [ ] NcodePublish.tsx 전면 수정
  - PDF 로드/드롭 기능
  - wasm-pdf-core 연동
  - NCode 삽입 (addNcodeLayer, flushAndDrawNcodeLayers)
  - NCode PDF 다운로드
- [ ] 파일명 형식: {원본파일명}-ncoded-{section}_{owner}_{book}_{page}.pdf
- **Status:** pending

### Phase 5: Testing & Integration
- [ ] Local PaperHub 기능 테스트
- [ ] paper-info 로컬/서버 폴백 테스트
- [ ] NCode PDF 생성 테스트
- [ ] 전체 워크플로우 테스트
- **Status:** pending

## Key Questions
1. IndexedDB 스키마 설계 - papers와 ncodeAllocation 테이블 구조?
   → papers: { sobKey, paperGroupId, title, section, owner, book, startPage, endPage, nprojXml, pdfBlob, createdAt }
   → ncodeAllocation: { section, owner, nextBookCode } 형태로 관리
2. 로컬 NCode 할당 로직 - section/owner 범위는?
   → section: 5 (기본값), owner: 1000~1255 (로컬 전용 범위 할당)
3. wasm-pdf-core 사용법 - NCode 삽입 순서?
   → prepareNcodeFont → addNcodeLayer → flushAndDrawNcodeLayers → saveBytes

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| IndexedDB 사용 | 브라우저 내장 DB로 별도 서버 불필요, 대용량 Blob 저장 가능 |
| section=5, owner=1000~1255 | 로컬 전용 범위로 서버와 충돌 방지 |
| wasm-pdf-core 직접 사용 | 이미 프로젝트에 포함되어 있음, NCode 삽입 기능 내장 |
| SOB 단위 캐싱 | 기존 paper-info.service.ts 패턴 유지 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- WebNeoSmartpen 라이브러리에 LocalPaperHub 구현
- shimizu-2026 프로젝트에서 NCode 발행 UI 구현
- wasm-pdf-core의 NcodeLayer, NeoPDFPage.addNcodeLayer 활용
- 기존 paper-info.service.ts 패턴(메모리 캐시 + API 폴백) 유지하면서 로컬 DB 추가
