# feature/restructure-v2 작업 로그

> 브랜치: `feature/restructure-v2`
> 기준 브랜치: `main`
> 작업일: 2026-02-25

---

## 완료된 작업

### Phase 0 — 사전 준비
**커밋: `[Phase 0]`**

- `CLAUDE.md` 프로젝트 지침 및 기획안 배치
- Docker Compose + Prisma seed 스크립트 추가
- 로그인 페이지 테스트 버튼 추가 (호스트 Mock / 선생님 Mock)
- 메신저, 음성통화 기능 비활성화 (코드 삭제 없이 `FEATURE_FLAGS`로 숨김 처리)

---

### Phase 1-1 — LNB 재구성
**커밋: `1dfb83c`**

- `HostLayout.tsx` — 사이드바(LNB) 재구성
  - 메뉴: 홈 / 세션 목록 / 내 워크시트 / 수업 결과
- 기존 메신저·음성 메뉴 숨김 처리

---

### Phase 1-2 — 홈 화면 (대시보드 + 세션 만들기 모달)
**커밋: `1a747f6`**

- `HostHomePage.tsx` — 대시보드 페이지 구현
  - 최근 세션 카드, 빠른 시작 버튼
- `CreateSessionModal.tsx` — 세션 만들기 모달
  - 필드: 수업 제목(필수), 날짜/시간, 참가 예정 인원(필수), 세션 비밀번호(자동생성), 게스트 모드 허용
  - DEV 모드: 백엔드 없이 Mock 세션 생성 (`devBridge.announceSession`)

---

### Phase 2-1 — 호스트 세션 화면 (뷰 탭)
**커밋: `7f11fa8`**

- `HostSessionView.tsx` — 호스트 세션 내 뷰 탭 구현
  - 탭 1: 기본 뷰 (캔버스)
  - 탭 2: 참가자 모드 뷰 (모니터링)
- DEV Mock 세션 진입 가능하도록 라우팅 수정

---

### Phase 2-2 — 참가자 모드 뷰 + DEV 브릿지
**커밋: `b71ac49`, `195a7b4`**

- `ParticipantMonitorGrid.tsx` — 참가자 필기 모니터링 그리드 (dev 브랜치 이식)
- `RedPenAnnotation.tsx` — 빨간펜 첨삭 기능 (dev 브랜치 이식)
- `devBridge.ts` — 멀티탭 DEV 브릿지 서비스 구현
  - `announceSession()` — 호스트 탭에서 localStorage에 세션 등록
  - `getSession(code)` — 게스트 탭에서 세션 정보 조회
  - `send()` / `on()` / `off()` — BroadcastChannel 기반 탭 간 이벤트 통신
- `useDevBridgeHost.ts` — 호스트 탭 훅 (게스트 참가 수신, 스트로크 수신)
- `useDevBridgeGuest.ts` — 게스트 탭 훅 (스트로크 전송, 첨삭 수신)

---

### Phase 1-5 — 수업 결과 페이지
**커밋: `42a6d50`, `5b3654b`**

- `LessonResultPage.tsx` — 수업 결과 페이지 완전 구현 (dev 브랜치 이식)
  - 세션 목록 사이드바 + 세션 결과 상세
  - 참여도 지표 (참여율 도넛 차트, 시간별 참여도 라인 차트)
  - 레이더 차트 (학생별 역량 분석)
  - 학생 카드 그리드 + 학생 상세 모달
  - PDF 다운로드 (html2canvas + jspdf)
  - recharts 기반 차트 컴포넌트

---

### Bug Fix — 빈 페이지 버그 수정
**커밋: `652322d`, `9726413`, `be01611`**

#### 문제 1: 세션 참가 후 빈 페이지
- **원인**: SessionPage에서 `session=null` 일 때 `return null` → 흰 빈 화면
- **수정** (`App.tsx` SessionPage):
  - `return null` → 로딩 스피너로 교체
  - `justJoined` 플래그가 있을 때 리다이렉트 방지

#### 문제 2: 초대 링크 → 자동 참가 안 됨
- **원인**: SessionLobby의 자동 참가 `useEffect`가 `password || inviteToken` 조건에서만 작동 — DEV 링크는 두 값 모두 없음. 또한 `handleJoinSession` stale closure 문제.
- **수정 1** (`SessionLobby.tsx`): `hasDevSession` 조건 추가 — `devBridge.getSession(code)` 존재 시 자동 참가 시도
- **수정 2** (`App.tsx` JoinPage): SessionLobby의 복잡한 useCallback 체인을 우회하여 JoinPage에서 직접 스토어 세팅
  ```
  devBridge.getSession(code) 확인
  → setCurrentUserId(guestId)
  → setSession({...}) 직접 호출
  → session 감지 useEffect에서 /session/:code로 자동 이동
  ```

> ⚠️ **미해결**: 빈 페이지 버그가 일부 시나리오에서 여전히 발생할 수 있음. 추가 디버깅 필요.

---

## 현재 미완료 항목 (기획안 기준)

| Phase | 항목 | 상태 |
|-------|------|------|
| 1-3 | 세션 목록 페이지 | 플레이스홀더 |
| 1-4 | 내 워크시트 페이지 | 플레이스홀더 |
| 2-3 | 필기중 뱃지 추가 | 미작업 |
| 3-1 | 첨삭 수신 모드 (게스트 Red Pen) | 미작업 |

---

## 주요 파일 변경 목록

### 신규 생성
- `Client/Web/src/components/host/HostLayout.tsx`
- `Client/Web/src/components/host/CreateSessionModal.tsx`
- `Client/Web/src/components/host/HostSessionView.tsx`
- `Client/Web/src/components/host/ParticipantMonitorGrid.tsx`
- `Client/Web/src/components/host/RedPenAnnotation.tsx`
- `Client/Web/src/pages/host/HostHomePage.tsx`
- `Client/Web/src/pages/host/SessionListPage.tsx` (플레이스홀더)
- `Client/Web/src/pages/host/WorksheetPage.tsx` (플레이스홀더)
- `Client/Web/src/pages/host/LessonResultPage.tsx`
- `Client/Web/src/services/dev-bridge.ts`
- `Client/Web/src/hooks/useDevBridgeHost.ts`
- `Client/Web/src/hooks/useDevBridgeGuest.ts`

### 수정
- `Client/Web/src/App.tsx` — 라우팅, SessionPage 빈 화면 수정, JoinPage DEV 자동 참가
- `Client/Web/src/components/session/SessionLobby.tsx` — DEV 자동 참가 조건 추가
- `Client/Web/src/pages/LoginPage.tsx` — 테스트 버튼 추가

---

## 로컬 테스트 방법

```bash
cd Client/Web
npm run dev
# → http://localhost:7190
```

**DEV 초대 링크 테스트 (백엔드 없이)**:
1. 호스트 탭: 로그인 → "호스트 Mock" → 홈 → 새 세션 만들기 → 세션 입장
2. 헤더 우측 → 초대 링크 복사
3. 새 탭: 링크 붙여넣기 → "선생님 Mock" 로그인 → 자동으로 세션 참가
