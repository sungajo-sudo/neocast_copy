# Findings & Decisions

## Requirements

### shimizu-2026 NcodePublish 페이지
- PDF 로드/드롭 기능
- paperRegister 함수로 IndexedDB에 저장
- wasm-pdf-core로 NCode PDF 생성
- 파일명: {원본}-ncoded-{section}_{owner}_{book}_{page}.pdf 다운로드

### WebNeoSmartpen 라이브러리
- Local PaperHub (IndexedDB 기반)
- paper-info wrapper: 로컬 우선, 서버 폴백
- paper-register wrapper: 설정에 따라 로컬/서버 선택 (기본: 로컬)
- NCode 할당 테이블 관리

## Research Findings

### 기존 paper-info.service.ts 구조
- 위치: `_NeoSmartpenPaf/WebNeoSmartpen/src/services/paper-info.service.ts`
- 패턴: 메모리 캐시 → API 폴백
- SOBKey 타입: `${section}.${owner}.${book}` 형식
- CachedPaperInfo: sobKey, paperGroupId, title, startPage, endPage, nprojJson, pdfBlob

### wasm-pdf-core NCode 삽입 방법
- 위치: `_NcodePapers/wasm-pdf-core/`
- 주요 클래스:
  - `NeoPDFDocument`: PDF 문서 관리, `prepareNcodeFont()`, `saveBytes()`
  - `NeoPDFPage`: 페이지 단위 작업, `addNcodeLayer()`, `flushAndDrawNcodeLayers()`
  - `NcodeLayer`: NCode 레이어 정보 (sobp, 좌표, excludeRegions)
- NCode 삽입 순서:
  1. `doc.openFromBuffer()`로 PDF 로드
  2. `doc.prepareNcodeFont()`로 폰트 준비
  3. 각 페이지에 대해:
     - `page.startNcodeLayersOverlay()`
     - `page.addNcodeLayer({ sobp, isPdfInRGB, ... })`
     - `page.flushAndDrawNcodeLayers()`
  4. `doc.saveBytes()`로 결과 저장

### 서버 nproj-generator.service.ts
- 위치: `PenStreamServer/src/services/nproj-generator.service.ts`
- 함수:
  - `getPdfPageCount()`: PDF 페이지 수 추출
  - `getPdfPageSize()`: MediaBox에서 페이지 크기 추출
  - `generateNproj()`: NPROJ XML 생성
- NPROJ 형식: XML, nproj version="2.4"

### 서버 paperhub-client.service.ts
- 위치: `PenStreamServer/src/services/paperhub-client.service.ts`
- NCode 할당: `allocateNCode(section, qty, unique, owner?)`
- Paper Group 생성: `createPaperGroupWithPdf(pdfBuffer, filename, nprojContent, info)`

### 타입 정의 (paper-info.ts)
- 위치: `WebNeoSmartpen/src/types/paper-info.ts`
- PaperInfoResponse: API 응답 타입
- NprojJson: NPROJ 파싱 결과
- CachedPaperInfo: 캐시된 paper 정보

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| IndexedDB 스키마 분리 | papers (PDF/NPROJ 저장), ncodeAllocation (할당 관리) |
| 로컬 owner 범위: 1000~1255 | 서버 할당(0~999)과 충돌 방지, 256개 owner 확보 |
| section=5 고정 | NCode 표준 section 값 |
| NPROJ 클라이언트 생성 | 서버 로직 재사용, 간단한 XML 생성 |
| wasm-pdf-core 직접 호출 | 이미 프로젝트에 포함, Worker 기반 비동기 처리 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources

### 파일 경로
- WebNeoSmartpen 서비스: `_NeoSmartpenPaf/WebNeoSmartpen/src/services/`
- WebNeoSmartpen 타입: `_NeoSmartpenPaf/WebNeoSmartpen/src/types/`
- shimizu-2026 페이지: `_NeoSmartpenSvr/SHIMIZU/shimizu-2026/src/pages/`
- wasm-pdf-core: `_NcodePapers/wasm-pdf-core/src/`
- PenStreamServer 서비스: `_NeoSmartpenSvr/PenStreamServer/src/services/`

### wasm-pdf-core API
- `createPDFWorkerEmployer()`: Worker employer 생성
- `NeoPDFContext`: PDF 작업 컨텍스트
- `NeoPDFDocument.openFromBuffer()`: 버퍼에서 PDF 로드
- `NeoPDFDocument.saveBytes()`: PDF를 Uint8Array로 저장
- `NeoPDFPage.addNcodeLayer()`: NCode 레이어 추가
- `NeoPDFPage.flushAndDrawNcodeLayers()`: NCode 레이어 적용

## Visual/Browser Findings
- NcodePublish.tsx 현재 상태: 스텝 기반 UI (업로드 → 처리 → 완료), 실제 NCode 생성 미구현 (더미 progress)
- wasm-pdf-core CLAUDE.md: Worker/Non-worker 모드 지원, pageNumber는 1-based, pageIndex는 0-based

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
