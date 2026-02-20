# PDF NCode 기능 구현 - Progress Log

## Session: 2026-01-25

### 분석 완료
- [x] shimizu-demo-2026 분석 (LocalPaperHub, NCode PDF Generator)
- [x] NeoCAST 서버 기존 코드 분석
- [x] NeoCAST 클라이언트 기존 코드 분석
- [x] 구현 계획 작성 (pdf-ncode-plan.md)
- [x] 분석 결과 정리 (pdf-ncode-findings.md)

### Phase 1: 서버 NcPaperHub API ✅ COMPLETE
- [x] Prisma 스키마에 NcodeAllocation, UserPaper 모델 추가
- [x] nc-paperhub.service.ts 구현 (SOBP 할당, PDF 등록, 조회)
- [x] nc-paperhub.ts 라우트 구현 (8개 엔드포인트)
- [x] index.ts에 라우트 등록
- [x] Prisma db push 완료

### Phase 2: 클라이언트 Local PaperHub ✅ COMPLETE
- [x] local-paperhub.service.ts 구현 (IndexedDB)
- [x] nc-paperhub-client.service.ts 구현 (서버 API 호출)
- [x] services/index.ts에 export 추가

### Phase 3: PDF 업로드 UI ✅ COMPLETE
- [x] PdfUploadModal.tsx 구현 (Drag & Drop, 업로드, 성공 상태)
- [x] layout/index.ts에 export 추가
- [x] App.tsx에 PdfUploadModal 추가
- [x] i18n 번역 추가 (en-US, ko)

### Bug Fixes Applied (2026-01-25)
- [x] Fixed `authService.getAccessToken()` - added method to auth-service.ts
- [x] Fixed `PdfUploadModal.tsx` - user info now from auth-store instead of session-store
- [x] Fixed unused imports in local-paperhub.service.ts and PdfUploadModal.tsx
- [x] Server and Client builds successful

### API Testing Results (2026-01-25)
All server APIs tested and working:
- [x] POST `/api/nc-paperhub/allocate` - Standalone SOBP allocation
- [x] POST `/api/nc-paperhub/attach` - PDF + NPROJ 첨부
- [x] GET `/api/nc-paperhub/papers` - List user's papers
- [x] GET `/api/nc-paperhub/paper/:id` - Get paper details
- [x] GET `/api/nc-paperhub/paper/:id/compound` - Get ncode-pdf compound
- SOBP allocation sequence working: Section 5, Owner 255, Book 0, Pages incrementing correctly

### Architecture Update (2026-01-25)
**중요 변경: NPROJ 생성을 서버에서 클라이언트로 이동**

할당 순서 수정:
- Page 순차 → Book 순차 → Owner 역순
- Page overflow → Book 증가, Book overflow → Owner 감소

새로운 흐름:
1. 클라이언트: `/allocate` 호출 → SOBP 할당 받음
2. 클라이언트: PDF 분석, NPROJ 생성 (nproj-generator.service.ts)
3. 클라이언트: `/attach` 호출 → PDF + NPROJ 업로드

변경된 파일:
- `Server/src/services/nc-paperhub.service.ts` - `registerPaper` → `attachPaper`로 변경, NPROJ 생성 제거
- `Server/src/routes/nc-paperhub.ts` - `/register` → `/attach`로 변경, multipart로 NPROJ 수신
- `Client/Web/src/services/nproj-generator.service.ts` - 새로 추가 (클라이언트 NPROJ 생성)
- `Client/Web/src/services/nc-paperhub-client.service.ts` - 새로운 흐름 구현 (allocate → generate → attach)

### 현재 Phase: Phase 4 - 채팅 공유 기능
**Status:** `pending`

### 다음 작업
1. 채팅으로 ncode-pdf compound 공유 기능 구현
2. compound 수신 및 Local PaperHub에 저장

---

## Files Created
| File | Purpose |
|------|---------|
| `pdf-ncode-plan.md` | 구현 계획 |
| `pdf-ncode-findings.md` | 분석 결과 |
| `pdf-ncode-progress.md` | 진행 로그 |
| `Server/src/services/nc-paperhub.service.ts` | SOBP 할당 및 PDF 첨부 서비스 |
| `Server/src/routes/nc-paperhub.ts` | API 라우트 (/allocate, /attach) |
| `Client/Web/src/services/local-paperhub.service.ts` | IndexedDB 기반 로컬 저장소 |
| `Client/Web/src/services/nc-paperhub-client.service.ts` | 서버 API 클라이언트 (allocate → generate → attach) |
| `Client/Web/src/services/nproj-generator.service.ts` | 클라이언트 NPROJ 생성기 |
| `Client/Web/src/components/layout/PdfUploadModal.tsx` | PDF 업로드 모달 |

## Files Modified
| File | Changes |
|------|---------|
| `Server/prisma/schema.prisma` | NcodeAllocation, UserPaper 모델 추가 |
| `Server/src/index.ts` | nc-paperhub 라우트 등록 |
| `Client/Web/src/services/index.ts` | local-paperhub, nc-paperhub-client export 추가 |
| `Client/Web/src/components/layout/index.ts` | PdfUploadModal export 추가 |
| `Client/Web/src/App.tsx` | PdfUploadModal import 및 렌더링 추가 |
| `Client/Web/src/i18n/locales/en-US.json` | pdf, common.tryAgain 번역 추가 |
| `Client/Web/src/i18n/locales/ko.json` | pdf, common.tryAgain 번역 추가 |

---

## Blockers
None currently

## Notes
- 기존 paperhub-client.service.ts는 NDP API용이므로 별도 nc-paperhub 서비스 구현 필요
- shimizu-demo의 WASM 기반 NCode PDF 생성은 Phase 5에서 구현
- Phase 3 완료: PDF 업로드 모달이 동작하며, ControlBar의 PDF 버튼 클릭 시 모달이 열림
- NPROJ 생성은 클라이언트에서 수행 (nproj-generator.service.ts)
- 서버는 SOBP 할당만 담당, NPROJ/PDF는 클라이언트에서 생성 후 첨부
