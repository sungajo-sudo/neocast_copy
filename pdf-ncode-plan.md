# PDF NCode 기능 구현 계획

## 개요
PDF 업로드 → NCode(SOBP) 할당 → ncode-pdf compound 생성 → 채팅 공유 → 인쇄 기능 구현

## 핵심 요구사항
1. **이용자별 SOBP 할당**: NDP PaperHub의 전역 유니크가 아닌, 각 이용자(호스트)별로 Unique한 SOBP
2. **ncode-pdf compound**: PDF + SOBP + nproj + 호스트 ID가 결합된 파일
3. **채팅 공유**: 생성된 compound를 채팅으로 다른 참가자에게 전달
4. **Local PaperHub**: 클라이언트의 IndexedDB에 nproj, PDF 저장
5. **NCode 인쇄**: PDF에 NCode 오버레이하여 인쇄

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Web)                             │
├─────────────────────────────────────────────────────────────────┤
│  PdfUploadModal ──→ API 호출 ──→ NcPaperHub Service             │
│       ↓                              ↓                          │
│  ncode-pdf compound 생성     Local PaperHub (IndexedDB)         │
│       ↓                              ↓                          │
│  Chat 공유 ──────────────────→ 다른 사용자 다운로드              │
│                                      ↓                          │
│                               NCode PDF 인쇄                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Server                                   │
├─────────────────────────────────────────────────────────────────┤
│  NcPaperHub API (이용자별 SOBP 관리)                            │
│       ↓                                                         │
│  Database: NcodeAllocation, Papers (per user)                   │
│       ↓                                                         │
│  File Storage: PDF, NPROJ 저장                                  │
│       ↓                                                         │
│  Fallback: NDP PaperHub API (없는 SOBP 요청 시)                 │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: 서버 - NcPaperHub API 구현
**Status:** `pending`

### 1.1 Prisma 스키마 추가
- `NcodeAllocation`: 이용자별 SOBP 할당 추적
  - userId, section, owner, currentBook, nextPage
- `UserPaper`: 이용자별 페이퍼 정보
  - userId, paperGroupId, sobKey, title, pageCount, nprojXml, pdfPath

### 1.2 NcPaperHub 서비스 구현 (Server)
- `POST /api/nc-paperhub/allocate`: SOBP 할당
  - Input: userId, pageCount
  - Output: section, owner, book, pageStart, pageEnd
  - Logic: 이용자별로 Section 5, Owner 255부터 감소
- `POST /api/nc-paperhub/register`: PDF + NPROJ 등록
  - Input: userId, pdfFile, title
  - Output: paperGroupId, sobp, nprojXml
- `GET /api/nc-paperhub/paper/:userId/:sobKey`: 페이퍼 조회
- `GET /api/nc-paperhub/paper/:userId/:sobKey/pdf`: PDF 다운로드
- `GET /api/nc-paperhub/paper/:userId/:sobKey/nproj`: NPROJ 다운로드

### 1.3 NDP Fallback 연동
- 로컬에 없는 SOBP 요청 시 NDP PaperHub API로 조회

### Files to Create/Modify:
- `Server/prisma/schema.prisma` - 스키마 추가
- `Server/src/services/nc-paperhub.service.ts` - 핵심 서비스
- `Server/src/routes/nc-paperhub.ts` - API 라우트

---

## Phase 2: 클라이언트 - Local PaperHub 구현
**Status:** `pending`

### 2.1 IndexedDB 스토어 구현
참고: shimizu-demo-2026의 `local-paperhub.service.ts`

- DB: `LocalPaperHub`
- Stores:
  - `papers`: hostId + sobKey로 PDF, NPROJ 저장
  - `ncodeAllocation`: 할당 상태 캐시

### 2.2 LocalPaperHub 서비스
- `storePaper(hostId, sobKey, pdf, nproj)`: 저장
- `getPaper(hostId, sobKey)`: 조회
- `hasPaper(hostId, sobKey)`: 존재 확인

### Files to Create:
- `Client/Web/src/services/local-paperhub.service.ts`
- `Client/Web/src/services/nc-paperhub-client.service.ts`

---

## Phase 3: PDF 업로드 UI 구현
**Status:** `pending`

### 3.1 PdfUploadModal 컴포넌트
- Drag & Drop PDF 업로드
- 파일 선택 버튼
- 업로드 진행 상태 표시
- 완료 후: NCode 정보 표시, 다운로드 버튼, 공유 버튼

### 3.2 상태 관리
- 업로드 진행 상태
- 할당된 SOBP 정보
- 생성된 compound 정보

### Files to Create:
- `Client/Web/src/components/layout/PdfUploadModal.tsx`
- i18n 번역 추가

---

## Phase 4: ncode-pdf compound 생성 및 공유
**Status:** `pending`

### 4.1 Compound 포맷 정의
```typescript
interface NcodePdfCompound {
  version: string;
  hostId: string;        // 호스트(생성자) ID
  hostName: string;      // 호스트 이름
  title: string;         // 문서 제목
  sobp: {
    section: number;
    owner: number;
    book: number;
    pageStart: number;
    pageEnd: number;
  };
  pageCount: number;
  nprojXml: string;      // NPROJ XML 내용
  pdfBase64: string;     // PDF Base64 인코딩
  createdAt: string;     // ISO 날짜
}
```

### 4.2 Compound 생성/다운로드
- JSON 형식으로 compound 생성
- `.ncpdf` 확장자로 다운로드

### 4.3 채팅 공유
- Chat에 compound 파일 첨부 기능
- 파일 메시지 타입 추가
- 다른 사용자가 클릭하면 다운로드

### Files to Modify:
- `Client/Web/src/stores/chat-store.ts` - 파일 메시지 타입
- `Server/src/socket/namespaces/chat.ns.ts` - 파일 전송 지원

---

## Phase 5: NCode PDF 인쇄 기능
**Status:** `pending`

### 5.1 Compound 열기/가져오기
- `.ncpdf` 파일 읽기
- Local PaperHub에 저장

### 5.2 NCode PDF 생성
참고: shimizu-demo-2026의 `ncode-pdf-generator.service.ts`

- WASM 기반 PDF + NCode 오버레이
- 진행 상태 표시

### 5.3 인쇄 UI
- 인쇄 설정 (Blueprint 모드, Scale 등)
- 페이지 선택
- 인쇄 미리보기

### Files to Create:
- `Client/Web/src/services/ncode-pdf-generator.service.ts`
- `Client/Web/src/components/pdf/NcodePrintDialog.tsx`

---

## Phase 6: 통합 및 테스트
**Status:** `pending`

### 6.1 전체 플로우 테스트
1. 호스트가 PDF 업로드
2. SOBP 할당 확인
3. Compound 다운로드
4. 채팅으로 공유
5. 게스트가 다운로드
6. NCode PDF 인쇄

### 6.2 에러 처리
- 업로드 실패
- SOBP 할당 실패
- 네트워크 오류

---

## 참고 파일
- shimizu-demo-2026:
  - `local-paperhub.service.ts` - IndexedDB + SOBP 할당
  - `ncode-pdf-generator.service.ts` - PDF + NCode 오버레이
  - `nproj-utils.ts` - NPROJ 파싱

## 기술 스택
- Server: Fastify, Prisma, TypeScript
- Client: React 19, Zustand, Tailwind CSS
- Storage: PostgreSQL (Server), IndexedDB (Client)

## 진행 상태
| Phase | 설명 | 상태 |
|-------|------|------|
| 1 | 서버 NcPaperHub API | pending |
| 2 | 클라이언트 Local PaperHub | pending |
| 3 | PDF 업로드 UI | pending |
| 4 | Compound 생성/공유 | pending |
| 5 | NCode PDF 인쇄 | pending |
| 6 | 통합 테스트 | pending |
