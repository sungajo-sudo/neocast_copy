# PDF NCode 기능 구현 - Findings

## 기존 코드 분석

### 1. 서버 측 기존 구현
- **paperhub-paper-register.ts**: NDP PaperHub API를 사용하는 PDF 등록 라우트
- **paperhub-client.service.ts**: NDP PaperHub API 클라이언트
- **nproj-generator.service.ts**: NPROJ XML 생성 유틸리티

**문제점**: 현재는 NDP PaperHub API를 사용하여 전역 유니크 SOBP를 할당하지만, 요구사항은 이용자별 SOBP 할당

### 2. 클라이언트 측 기존 구현
- **PdfUploadButton.tsx**: 버튼만 있고, 모달은 없음
- **panel-store.ts**: `isPdfUploadOpen` 상태 있음, 하지만 이를 사용하는 모달이 없음

**문제점**: PDF 버튼 클릭 시 아무 동작 없음 (모달 컴포넌트 미구현)

---

## shimizu-demo-2026 분석 결과

### Local PaperHub 구조 (IndexedDB)
```typescript
// DB: LocalPaperHub, Version: 5
// Stores:
// 1. papers - PDF + NPROJ 저장
// 2. ncodeAllocation - SOBP 할당 상태
// 3. sobpAllocations - 할당 히스토리
// 4. revokedNcodes - 취소된 NCode

interface StoredPaper {
  sobKey: string;           // "S.O.B" 형식
  paperGroupId: string;     // UUID
  title: string;
  section: number;
  owner: number;
  book: number;
  startPage: number;
  endPage: number;
  pageCount: number;
  nprojXml: string;
  pdfBlob: Blob;
  createdAt: number;
}
```

### SOBP 할당 정책
```typescript
const LOCAL_SECTION = 5;              // 고정
const LOCAL_OWNER_START = 255;        // 감소 방향
const LOCAL_OWNER_MIN = 0;
const LOCAL_START_BOOK = 0;           // 증가 방향
const BOOK_MAX_VALUE = 4095;          // 12-bit
const PAGE_MAX_VALUE = 4095;          // 12-bit
```

### 할당 알고리즘
1. 현재 owner/book/page 상태 조회
2. 요청 페이지 수가 현재 book에 들어가는지 확인
3. 페이지 초과 시 book 증가, book 초과 시 owner 감소
4. 할당 결과 저장 및 반환

### NCode PDF 생성 (WASM)
```typescript
// 주요 과정:
// 1. PDFWorkerEmployer 초기화
// 2. NeoPDFContext 생성
// 3. 각 페이지에 NCode 레이어 추가
// 4. PDF 저장
```

---

## NeoCAST 구현 방향

### 서버 구현 (NcPaperHub)
- Prisma 스키마에 `NcodeAllocation`, `UserPaper` 테이블 추가
- 이용자별 SOBP 할당 서비스 구현
- PDF/NPROJ 파일 저장소 연동

### 클라이언트 구현
- `PdfUploadModal` 컴포넌트 생성
- `LocalPaperHubService` 구현 (IndexedDB)
- `NcPaperHubClientService` 구현 (서버 API 호출)
- ncode-pdf compound 포맷 정의

---

## 좌표계 변환 참고
```typescript
// PDF Units (PU) ↔ NCode Units (NU)
// 1 PU = 1/72 inch
// 1 NU = 1/600 inch × 8 × 7
// Conversion: PU_TO_NU = 0.148809523809524
```

---

## 파일 경로 참고
- shimizu-demo LocalPaperHub: `/Users/kitty/work/NL-LIB/NeoSmartpenPAF/_Demos/shimizu-demo-2026/sub-modules/WebNeoSmartpen/src/services/local-paperhub.service.ts`
- shimizu-demo NCode PDF Generator: `/Users/kitty/work/NL-LIB/NeoSmartpenPAF/_Demos/shimizu-demo-2026/src/services/ncode-pdf-generator.service.ts`
