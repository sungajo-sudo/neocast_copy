# NeoCast 작업 로그

> **중요**: 이 문서에 기록된 정상 작동 기능들은 절대 다른 기능과 충돌되어서는 안 됩니다.
> 새로운 기능 추가 시 반드시 이 로그를 참조하여 기존 기능을 보호해야 합니다.

---

## 2026-02-26: 스마트펜 연결 및 실시간 동기화 구현 (dev 브랜치)

### ✅ 구현 완료 기능 (절대 수정 금지 - 정상 작동 확인됨)

#### 1. 캔버스 크기 조정 (A4 세로 비율)
- **파일**:
  - `Client/src/components/GuestCanvas.tsx`
  - `Client/src/components/host-canvas/HostCanvas.tsx`
  - `Client/src/components/StudentMiniCanvas.tsx`
  - `Client/src/components/StudentDetailView.tsx`

- **변경 사항**:
  - 캔버스 크기: **700px × 990px** (A4 세로 비율 1:√2)
  - 학생 카드 크기: **350px × 346px** (A4 비율 70% 높이)
  - 상세 보기: **700px × 990px** (A4 세로 비율)

- **핵심 코드**:
  ```typescript
  const CANVAS_W = 700;
  const CANVAS_H = Math.round(CANVAS_W * Math.sqrt(2)); // 990
  ```

- **동작**: ✅ 호스트/게스트 모두 A4 세로 비율 캔버스 정상 표시

---

#### 2. 게스트 화면 레이아웃 (가로 배치)
- **파일**: `Client/src/components/GuestCanvas.tsx`

- **변경 사항**:
  - 선생님 판서(왼쪽) + 내 필기(오른쪽) 가로 배치
  - 선생님 판서 없을 때 내 필기 가운데 정렬
  - `flexDirection: 'row'`
  - `justifyContent: hostStrokes.length > 0 ? 'flex-start' : 'center'`

- **핵심 코드**:
  ```typescript
  <div style={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: hostStrokes.length > 0 ? 'flex-start' : 'center',
      gap: 20,
  }}>
      {/* 선생님 판서 */}
      {hostStrokes.length > 0 && <div>...</div>}
      {/* 내 필기 */}
      <div>...</div>
  </div>
  ```

- **동작**: ✅ 선생님 판서 표시 시 좌우 배치, 없을 때 가운데 정렬

---

#### 3. 스마트펜 Web Bluetooth 연결 (main 브랜치 이식)
- **새로운 파일**:
  - `Client/src/services/pen-protocol.ts` - NeoSmartpen Protocol V2
  - `Client/src/services/web-bluetooth.service.ts` - Web Bluetooth API 래퍼
  - `Client/src/services/neosmartpen.service.ts` - 펜 프로토콜 파싱
  - `Client/src/stores/pen-store.ts` - Zustand 펜 상태 관리
  - `Client/src/types/web-bluetooth.d.ts` - TypeScript 타입 정의

- **수정된 파일**:
  - `Client/src/components/control-bar/SmartpenButton.tsx`

- **기능**:
  - ✅ Web Bluetooth API 기반 NeoSmartpen 연결
  - ✅ 기기 스캔 및 페어링
  - ✅ 인증 및 비밀번호 처리
  - ✅ 배터리, 기기 정보 표시
  - ✅ 연결 상태별 UI 피드백 (초록색 도트 + 기기명)
  - ✅ 드롭다운 메뉴 (기기 정보, 비밀번호 입력, 연결 해제)

- **핵심 서비스**:
  ```typescript
  // Web Bluetooth 기기 연결
  webBluetoothService.requestDevice()
  webBluetoothService.connectDevice()

  // NeoSmartpen 프로토콜 처리
  neosmartpenService.onConnected()
  neosmartpenService.onDot()
  neosmartpenService.onBattery()
  ```

- **동작**: ✅ Chrome/Edge에서 실제 NeoSmartpen 연결 및 상태 표시

---

#### 4. 스마트펜 Dot 데이터 → Stroke 변환
- **새로운 파일**: `Client/src/services/pen-input.service.ts`

- **수정된 파일**:
  - `Client/src/components/MonitoringView.tsx` (펜 입력 서비스 초기화)
  - `Client/src/components/GuestCanvas.tsx` (펜 입력 서비스 초기화)

- **기능**:
  - ✅ NeoSmartpen dot 이벤트를 stroke로 변환
  - ✅ Ncode 좌표 → 72 DPI point 변환
  - ✅ DemoStrokeCanvas 렌더링 연동
  - ✅ PenDown/PenMove/PenUp 이벤트 처리

- **핵심 코드**:
  ```typescript
  // Ncode → Point 변환 상수
  const NCODE_TO_MM = 2.37066667;
  const INTERNAL_DPI = 72;
  const MM_TO_PT = INTERNAL_DPI / 25.4;
  const NCODE_TO_PT = NCODE_TO_MM * MM_TO_PT; // ≈ 6.72

  function ncodeToPoint(ncodeValue: number): number {
      return ncodeValue * NCODE_TO_PT;
  }
  ```

- **동작**: ✅ 물리 노트 필기 시 즉시 화면에 stroke 표시

---

#### 5. 선생님 스마트펜 필기 → 학생 화면 실시간 동기화
- **파일**: `Client/src/services/pen-input.service.ts`

- **변경 사항**:
  - 스마트펜 stroke 완료 시 localStorage 저장
  - 기존 마우스 필기와 동일한 저장 방식
  - 키: `nc_strokes_${sessionId}_${userId}`

- **핵심 코드**:
  ```typescript
  case DotType.PenUp:
      // localStorage에 저장
      const strokeKey = `nc_strokes_${sessionId}_${userId}`;
      const strokes = JSON.parse(localStorage.getItem(strokeKey) || '[]');
      strokes.push(newStroke);
      localStorage.setItem(strokeKey, JSON.stringify(strokes));
  ```

- **동작**: ✅ 선생님 스마트펜 필기 → 0.5초 이내 학생 "선생님 판서" 화면에 표시

---

#### 6. 호스트 캔버스 지우기 기능
- **파일**: `Client/src/components/host-canvas/HostCanvas.tsx`

- **기능**:
  - ✅ "지우기" 버튼 추가 (빨간색 테두리 + 휴지통 아이콘)
  - ✅ 확인 대화상자 (사용자 실수 방지)
  - ✅ demoStrokeStore 및 localStorage 동시 삭제
  - ✅ 학생 화면도 자동 동기화 (0.5초 이내)

- **핵심 코드**:
  ```typescript
  const handleClearCanvas = useCallback(() => {
      if (!confirm('캔버스의 모든 필기를 지우시겠습니까?')) return;

      // 스토어에서 지우기
      clearUserStrokes(userId);

      // localStorage에서도 지우기
      const strokeKey = `nc_strokes_${sessionId}_${userId}`;
      localStorage.removeItem(strokeKey);
  }, [userId, sessionId, clearUserStrokes]);
  ```

- **동작**: ✅ 호스트 캔버스 지우기 → 학생 화면도 동기화됨

---

#### 7. 학생 필기중 뱃지 (실시간 표시)
- **파일**:
  - `Client/src/components/StudentMiniCanvas.tsx` (뱃지 UI)
  - `Client/src/components/MonitoringView.tsx` (상태 폴링)
  - `Client/src/components/GuestCanvas.tsx` (마우스 필기 상태 저장)
  - `Client/src/services/pen-input.service.ts` (스마트펜 필기 상태 저장)

- **기능**:
  - ✅ 학생이 마우스 또는 스마트펜으로 필기 시작 → "✏️ 필기중" 초록 뱃지
  - ✅ 필기 완료 → 뱃지 사라짐
  - ✅ localStorage 기반 실시간 동기화 (0.5초 폴링)
  - ✅ 3초 타임아웃 (비정상 종료 대응)

- **핵심 코드**:
  ```typescript
  // 필기 시작 시
  localStorage.setItem(`nc_writing_${sessionId}_${userId}`, Date.now().toString());

  // 필기 완료 시
  localStorage.removeItem(`nc_writing_${sessionId}_${userId}`);

  // 호스트 폴링 (0.5초마다)
  const checkWritingStatus = () => {
      const now = Date.now();
      participants.forEach(p => {
          const timestamp = localStorage.getItem(`nc_writing_${sessionId}_${p.userId}`);
          if (timestamp && (now - parseInt(timestamp)) < 3000) {
              writing.add(p.userId);
          }
      });
  };
  ```

- **뱃지 우선순위**:
  1. **첨삭중 (빨강)**: 선생님이 첨삭 모드일 때 (최우선)
  2. **필기중 (초록)**: 학생이 stroke 그리는 중
  3. **없음**: idle 상태

- **동작**: ✅ 학생 필기 시작 → 0.5초 이내 호스트 그리드에 뱃지 표시

---

### 📁 파일 구조 (새로 추가된 파일)

```
Client/src/
├── services/
│   ├── pen-protocol.ts              ← 새 파일 (NeoSmartpen 프로토콜)
│   ├── web-bluetooth.service.ts     ← 새 파일 (Web Bluetooth API)
│   ├── neosmartpen.service.ts       ← 새 파일 (펜 데이터 파싱)
│   └── pen-input.service.ts         ← 새 파일 (Dot→Stroke 변환)
├── stores/
│   └── pen-store.ts                 ← 새 파일 (펜 상태 관리)
├── types/
│   └── web-bluetooth.d.ts           ← 새 파일 (TypeScript 타입)
└── components/
    ├── control-bar/
    │   └── SmartpenButton.tsx       ← 수정 (드롭다운 메뉴 추가)
    ├── host-canvas/
    │   └── HostCanvas.tsx           ← 수정 (지우기 버튼 추가)
    ├── GuestCanvas.tsx              ← 수정 (레이아웃, 필기중 상태)
    ├── MonitoringView.tsx           ← 수정 (필기중 뱃지 폴링)
    ├── StudentMiniCanvas.tsx        ← 수정 (필기중 뱃지 UI)
    └── StudentDetailView.tsx        ← 수정 (A4 크기)
```

---

### 🔒 보호해야 할 핵심 로직 (절대 변경 금지)

#### 1. localStorage 키 규칙
```
nc_strokes_${sessionId}_${userId}     - 완료된 stroke 저장
nc_writing_${sessionId}_${userId}     - 필기중 상태 (timestamp)
nc_participants_${sessionId}           - 참가자 목록
nc_annotations_${sessionId}_${userId}  - 첨삭 데이터
```

#### 2. 폴링 주기
```typescript
호스트 스트로크 폴링: 500ms (0.5초)
참가자 목록 폴링: 1000ms (1초)
필기중 상태 폴링: 500ms (0.5초)
첨삭 데이터 폴링: 500ms (0.5초)
```

#### 3. Ncode 좌표 변환
```typescript
NCODE_TO_PT = 2.37066667 × (72/25.4) ≈ 6.72
```
**절대 변경 금지** - NeoLAB 공식 변환 상수

#### 4. 캔버스 크기
```typescript
CANVAS_W = 700
CANVAS_H = Math.round(CANVAS_W * Math.sqrt(2)) // 990
```
**절대 변경 금지** - A4 세로 비율

---

### ⚠️ 회귀 방지 체크리스트

새로운 기능 추가 시 다음을 반드시 확인:

- [ ] localStorage 키 규칙 준수
- [ ] 폴링 주기 변경하지 않음
- [ ] Ncode 변환 상수 유지
- [ ] 캔버스 크기 비율 유지
- [ ] 스마트펜 연결 프로토콜 유지
- [ ] 기존 stroke 렌더링 로직 보호
- [ ] 필기중 뱃지 로직 보호

---

### 🧪 테스트 완료 항목

- [x] 스마트펜 연결 (Neo smartpen N2, Dimo)
- [x] 물리 노트 필기 → 화면 표시
- [x] 선생님 스마트펜 → 학생 화면 동기화
- [x] 마우스 필기 → 학생 화면 동기화
- [x] 호스트 캔버스 지우기
- [x] 학생 필기중 뱃지 (마우스)
- [x] 학생 필기중 뱃지 (스마트펜)
- [x] A4 세로 비율 캔버스
- [x] 가로 레이아웃 (선생님 판서 + 내 필기)
- [x] TypeScript 컴파일 에러 없음
- [x] 브라우저: Chrome, Edge (Web Bluetooth 지원)

---

### 📝 기술 스택

- **Frontend**: React 19, TypeScript, Vite, Zustand
- **실시간 동기화**: localStorage 폴링 (0.5s~1s)
- **스마트펜**: Web Bluetooth API, NeoSmartpen Protocol V2
- **좌표 변환**: Ncode → 72 DPI Point
- **캔버스**: HTML5 Canvas, A4 세로 비율

---

### 🎯 다음 작업 시 주의사항

1. **절대 수정 금지**:
   - localStorage 키 규칙
   - 폴링 주기
   - Ncode 변환 상수
   - 캔버스 크기/비율
   - 스마트펜 프로토콜

2. **확장 가능**:
   - 새로운 펜 타입 추가 (형광펜, 지우개 등)
   - 색상/굵기 프리셋 추가
   - 추가 뱃지/상태 표시
   - 새로운 동기화 데이터 (별도 키 사용)

3. **테스트 필수**:
   - 기존 기능 회귀 테스트
   - 스마트펜 연결 테스트
   - 실시간 동기화 테스트
   - 크로스 브라우저 테스트

---

### 📞 문제 발생 시

이 로그에 기록된 기능이 작동하지 않으면:
1. 이 커밋으로 롤백
2. 새 기능과 충돌 지점 파악
3. 이 로그의 "보호해야 할 핵심 로직" 확인
4. 회귀 방지 체크리스트 수행

---

**작성일**: 2026-02-26
**브랜치**: dev
**작성자**: Claude Code Assistant
**상태**: ✅ 전체 기능 정상 작동 확인 완료

---

## 2026-03-09: 호스트 대시보드 전면 개편 + PDF 기능 (master_instructions_v3 STEP 1~7 + 기능 A+B)

### 개요

기존 로그인 기반 대시보드를 제거하고, 워크시트 중심의 호스트 대시보드로 전면 재편.
PDF 업로드→썸네일→세션 시작→캔버스 배경 렌더링 전체 흐름 구현.
스마트펜 첫 stroke 감지 시 PDF 배경 fade-in 연출, 멀티페이지 기능 추가.

---

### STEP 1 — 진입 흐름 + LNB 재편

#### 신규/수정 파일

| 파일 | 구분 | 내용 |
|---|---|---|
| `client/src/App.tsx` | 수정 | 로그인 라우트 제거, `/` → `/host/worksheets` 리다이렉트, HostLayout 중첩 라우팅 |
| `client/src/components/layout/LNB.tsx` | 수정 | 메뉴 3개로 재편 (워크시트/세션/아카이브), 하단 설정 버튼 고정 |
| `client/src/pages/host/Sessions.tsx` | 신규 (rename) | 구 SessionList.tsx → Sessions.tsx |
| `client/src/pages/host/Archive.tsx` | 신규 (rename) | 구 Results.tsx → Archive.tsx |
| `client/src/pages/host/ArchiveDetail.tsx` | 신규 (rename) | 구 SessionDetail.tsx → ArchiveDetail.tsx |
| `client/src/pages/host/StudentReport.tsx` | 신규 (rename) | 구 StudentReportDetail.tsx → StudentReport.tsx (호스트용) |

#### 라우팅 구조

```
/                    → redirect → /host/worksheets
/host/worksheets     → Worksheets (기본 랜딩)
/host/sessions       → Sessions
/host/archive        → Archive
/host/archive/:sessionId          → ArchiveDetail
/host/archive/:sessionId/student/:studentId → StudentReport
/join                → GuestJoin (기존 유지)
/waiting             → GuestWaiting (기존 유지)
/session             → SessionPage (기존 유지)
```

---

### STEP 2 — 워크시트 페이지 전면 개편

#### 신규/수정 파일

| 파일 | 구분 | 내용 |
|---|---|---|
| `client/src/pages/host/Worksheets.tsx` | 수정 (전면 재작성) | PDF 업로드 + pdfjs 썸네일 + 카드 그리드 + 세션 시작 |
| `client/src/components/modals/CreateSessionModal.tsx` | 수정 | `initialWorksheetId` prop 추가, 파일 업로드 → 드롭다운 선택으로 교체 |

#### 동작 방식

- PDF 업로드 시 pdfjs-dist로 1페이지 썸네일 생성 → localStorage 저장
- localStorage 키: `nc_ws_meta_*`, `nc_ws_thumb_*`, `nc_ws_pdf_*`
- 카드 [세션 시작] 클릭 → CreateSessionModal이 해당 워크시트 미리 선택된 상태로 열림
- [NCode PDF], [.np2] 다운로드 버튼 유지 (향후 구현)

---

### STEP 3 — 세션 캔버스 PDF 배경 렌더링

#### 신규 파일

| 파일 | 내용 |
|---|---|
| `client/src/stores/pdfPageStore.ts` | imageUrl / totalPages / currentPage / opacity Zustand 스토어 |
| `client/src/hooks/usePdfBackground.ts` | PDF 로드 + 페이지 렌더링 + 게스트 500ms 폴링 |
| `client/src/components/canvas/PdfBackground.tsx` | 훅 마운트 컴포넌트 + 페이지 인디케이터 UI |

#### 수정 파일

| 파일 | 내용 |
|---|---|
| `client/src/components/canvas/DemoStrokeCanvas.tsx` | pdfPageStore.imageUrl 읽어서 PDF를 canvas 2D에 배경으로 렌더링 |
| `client/src/App.tsx` | `/session` 라우트에 `<PdfBackground />` 주입 (SessionPage 무수정) |
| `client/src/pages/host/Sessions.tsx` | 세션 시작 시 `nc_session_worksheet_${sessionId}` 저장 |

#### localStorage 신규 키

```
nc_session_worksheet_${sessionId}  — 세션에 연결된 worksheetId
nc_session_page_${sessionId}       — 현재 페이지 번호 (호스트 기준, 게스트 폴링용)
```

#### 동작 방식

1. 워크시트 있는 세션 시작 → `nc_session_worksheet_${sessionId}` 저장
2. `usePdfBackground` 훅이 PDF 로드 → pdfjs로 각 페이지를 base64 이미지로 변환
3. `DemoStrokeCanvas`가 RAF 루프에서 PDF 이미지를 canvas에 먼저 그린 뒤 stroke 덮어씀
4. 게스트: 500ms 폴링으로 `nc_session_page_*` 읽어 호스트와 페이지 동기화

---

### STEP 4 — CreateSessionModal 워크시트 드롭다운

#### 수정 파일

| 파일 | 내용 |
|---|---|
| `client/src/components/modals/CreateSessionModal.tsx` | 파일 업로드 제거 → `nc_ws_meta_*` 목록 드롭다운으로 교체 |
| `client/src/pages/host/Sessions.tsx` | 세션 카드에 워크시트 썸네일 표시 |

---

### STEP 5 — 아카이브 페이지

#### 수정 파일

| 파일 | 내용 |
|---|---|
| `client/src/data/dummyData.ts` | `SessionResult.worksheet` 필드 추가 |
| `client/src/pages/host/Archive.tsx` | 테이블에 "워크시트" 컬럼 추가 |
| `client/src/pages/host/ArchiveDetail.tsx` | 헤더에 워크시트명 표시, localStorage → 더미 데이터 순으로 세션 로드 |

---

### STEP 6 — GuestJoin UI 개선

#### 수정 파일

| 파일 | 내용 |
|---|---|
| `client/src/pages/GuestJoin.tsx` | 하단 "선생님이라면? → 선생님 대시보드로" 링크 추가 (`/host/worksheets`) |

---

### STEP 7 — 더미 데이터 정리

#### 수정 파일

| 파일 | 내용 |
|---|---|
| `client/src/data/dummyData.ts` | `DUMMY_WORKSHEETS` 3개 추가, Session/SessionResult에 `worksheetId` 연결 |

---

### 기능 A — 스마트펜 첫 stroke 시 PDF 배경 fade-in

#### 신규 파일

| 파일 | 내용 |
|---|---|
| `client/src/services/pen-event-bridge.ts` | `nc_writing_${sessionId}_${userId}` 200ms 폴링 → 첫 감지 시 콜백 1회 호출 후 중단 |
| `client/src/hooks/usePdfFadeIn.ts` | 첫 stroke 감지 → RAF로 opacity 0→1 애니메이션(300ms) + page-store 연동 + 게스트 sync |

#### 수정 파일

| 파일 | 내용 |
|---|---|
| `client/src/stores/pdfPageStore.ts` | `opacity: number` 필드 추가 (기본값 0) |
| `client/src/components/canvas/DemoStrokeCanvas.tsx` | PDF 그릴 때 `ctx.globalAlpha = pdfOpacity` 적용 |
| `client/src/components/canvas/PdfBackground.tsx` | `usePdfFadeIn()` 마운트로 교체, ◀▶ 버튼 제거, 페이지 인디케이터만 유지 |

#### 동작 방식

```
세션 진입
  → pdfPageStore.opacity = 0 (PDF 로드되어 있지만 화면에 보이지 않음)
  → pen-event-bridge: nc_writing_${sessionId}_${userId} 200ms 폴링 시작
스마트펜 첫 획
  → nc_writing_* 키 생성 감지
  → RAF 루프: opacity 0 → 1 (300ms 선형 보간)
  → DemoStrokeCanvas: ctx.globalAlpha = opacity 로 PDF 이미지 fade-in
워크시트 없는 세션
  → pdfPageStore.imageUrl = null → 아무것도 렌더링하지 않음 (흰 배경 유지)
```

---

### 기능 B — 멀티페이지 기능

#### 신규 파일

| 파일 | 내용 |
|---|---|
| `client/src/components/control-bar/PagesButton.tsx` | 고정 위치 페이지 버튼 (`N / Total` 표시), 클릭 시 `toggleLeftPanel('pages')` |
| `client/src/components/panels/PagesPanel.tsx` | 좌측 슬라이드인 패널 (너비 200px), 페이지 추가/이동/삭제, 게스트 동기화 상태 표시 |

#### 수정 파일

| 파일 | 내용 |
|---|---|
| `client/src/pages/SessionPage.tsx` | `<PagesPanel />` + `<PagesButton />` 2줄 추가 (기존 로직 무변경) |

#### 활용 스토어 (기존 파일, 수정 없음)

| 스토어 | 역할 |
|---|---|
| `client/src/stores/page-store.ts` | `pages`, `currentPageId`, `addPage`, `setCurrentPage`, `deletePage`, `initializeFirstPage` |
| `client/src/stores/panel-store.ts` | `activeLeftPanel: 'pages' \| null`, `toggleLeftPanel` |
| `client/src/stores/demoStrokeStore.ts` | `getStrokesByPage(userId, pageId)` — 페이지별 stroke 격리 |

#### localStorage 신규 키

```
nc_session_pages_${sessionId}  — { pages: PageInfo[], currentPageId: string }
  호스트: 페이지 추가/이동 시 저장
  게스트: 500ms 폴링으로 읽어 동기화
```

#### 동작 방식

```
PagesButton 클릭 → PagesPanel 슬라이드인
[+] 클릭 → addPage() → 새 페이지 생성 → nc_session_pages_* 저장
페이지 클릭 → setCurrentPage(id) → usePdfFadeIn이 감지 → 해당 PDF 페이지 렌더링
[✕] 클릭 → deletePage(id) (1개일 때 비활성)
게스트: 500ms 폴링 → 호스트 페이지 추가/이동 감지 → 자동 동기화
```

---

### 전체 파일 구조 (2026-03-09 기준 추가/변경분)

```
client/src/
├── App.tsx                              수정 — 라우팅 전면 재편
├── data/
│   └── dummyData.ts                     수정 — worksheetId 연결, DUMMY_WORKSHEETS 추가
├── stores/
│   └── pdfPageStore.ts                  신규 — PDF 페이지 상태 (imageUrl/page/opacity)
├── services/
│   └── pen-event-bridge.ts              신규 — 첫 stroke 감지 폴링 유틸리티
├── hooks/
│   ├── usePdfBackground.ts              신규 — PDF 로드 + 페이지 렌더링 + 게스트 폴링
│   └── usePdfFadeIn.ts                  신규 — fade-in 애니메이션 + page-store 연동
├── components/
│   ├── layout/
│   │   └── LNB.tsx                      수정 — 메뉴 3개 재편
│   ├── canvas/
│   │   ├── DemoStrokeCanvas.tsx         수정 — PDF globalAlpha 적용
│   │   └── PdfBackground.tsx            신규 — 훅 마운트 + 페이지 인디케이터
│   ├── control-bar/
│   │   └── PagesButton.tsx              신규 — 페이지 패널 토글 버튼
│   ├── panels/
│   │   └── PagesPanel.tsx               신규 — 페이지 목록 사이드 패널
│   └── modals/
│       └── CreateSessionModal.tsx       수정 — 워크시트 드롭다운
└── pages/
    ├── GuestJoin.tsx                    수정 — 선생님 링크 추가
    ├── SessionPage.tsx                  수정 — PagesPanel/PagesButton 주입 (2줄)
    └── host/
        ├── Worksheets.tsx               수정 — PDF 업로드 + 썸네일 카드
        ├── Sessions.tsx                 신규 (rename) — 세션 목록
        ├── Archive.tsx                  신규 (rename) — 아카이브 목록
        ├── ArchiveDetail.tsx            신규 (rename) — 아카이브 상세
        └── StudentReport.tsx            신규 (rename) — 학생 개인 리포트
```

---

### 커밋 이력

| 커밋 | 내용 |
|---|---|
| `167ec35` | feat: PDF fade-in 연출 + 페이지 기능 (기능 A+B) |
| 이전 커밋들 | STEP 1~7 (master_instructions_v3) |

**작성일**: 2026-03-09
**브랜치**: dev
**커밋**: `167ec35`
**TypeScript**: ✅ 에러 없음
