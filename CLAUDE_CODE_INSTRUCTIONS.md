# feature/restructure-v2 버그 수정 작업 지침

> 브랜치: `feature/restructure-v2`
> 작업일: 2026-02-26
> 이 지침은 **단계별로 실행 후 반드시 멈추고 사용자 확인**을 받아야 합니다.

---

## 배경

디버깅을 통해 다음 사항이 확인되었습니다:

1. **게스트 빈 페이지 원인**: `GuestAnnotationOverlay` 컴포넌트에서 `Maximum update depth exceeded` (무한 루프) 에러 → React 전체 크래시 → 빈 화면. 현재 임시로 비활성화된 상태.
2. **호스트↔게스트 스트로크 양방향 전송 누락**: `useDevBridgeHost`에서 호스트→게스트 방향 스트로크 전송이 없고, `useDevBridgeGuest`에서 호스트 스트로크 수신 처리가 없음.
3. **JoinPage에서 GUEST_JOIN 이벤트 미전송**: 호스트 화면에 게스트 참가자가 안 보임.
4. **호스트→게스트 첨삭 미동작**: Phase 3-1 미작업 상태.
5. **`penInputService.initialize()`는 App 컴포넌트 최상위에서 정상 호출됨** (line 926). 스마트펜 초기화 자체는 문제 없음.
6. **`isStylusOn` 기본값은 true** (panel-store.ts line 125). 마우스 입력 비활성화 문제 아님.
7. **테스트 "게스트" 버튼은 실제로 일반 사용자(guest@abc.com)로 로그인**됨. 게스트 모드(loginAsGuest)가 아님. 이것은 정상 동작이며, `isHost: false`로 올바르게 판별됨.

### 현재 상태
- `GuestAnnotationOverlay`가 App.tsx에서 주석 처리됨 (임시)
- SessionPage에 디버그 로그가 추가됨 (제거 필요)
- 게스트 캔버스는 보이는 상태

### DEV 모드 테스트 방법
- `cd Client/Web && npm run dev` → http://localhost:7190
- 탭 1 (호스트): "호스트" 테스트 로그인 → /host → 세션 만들기 → 입장
- 탭 2 (게스트): **같은 브라우저 일반 새 탭**에서 초대 링크 붙여넣기 → 게스트 참가
- ⚠️ 시크릿 탭 사용 불가 (localStorage가 분리되어 devBridge 작동 안 함)

---

## 🔴 중요: 작업 규칙

1. **각 단계 완료 후 반드시 멈추고 사용자에게 테스트 확인을 요청하세요.**
2. **한 번에 여러 단계를 진행하지 마세요.**
3. **수정 전에 반드시 현재 파일 내용을 먼저 확인(cat/read)하세요.**
4. **main 브랜치의 캔버스 관련 파일(CanvasContainer, InputCanvas, StrokeCanvas, stroke-store 등)은 수정하지 마세요.** 이 파일들은 main과 공유됩니다.
5. **각 단계 완료 후 git commit하세요.** 커밋 메시지 형식: `[Fix-N] 설명`

---

## 단계 1: GuestAnnotationOverlay 무한 루프 수정

### 목표
`GuestAnnotationOverlay.tsx`의 무한 루프를 수정하여 게스트 화면에서 정상 렌더링되도록 합니다.

### 작업 내용
1. `Client/Web/src/components/session/GuestAnnotationOverlay.tsx` 파일을 읽어서 분석
2. `Maximum update depth exceeded` 원인 찾기. 보통 다음 패턴 중 하나:
   - `useEffect` 의존성 배열에 매 렌더마다 새로 생성되는 객체/배열/함수가 포함
   - `useEffect` 내부에서 상태 변경 → 리렌더 → 같은 useEffect 재실행 순환
   - Zustand selector가 매번 새 참조를 반환 (예: `.filter()`, `.map()` 결과)
3. 무한 루프 수정
4. App.tsx에서 GuestAnnotationOverlay 주석 해제 (임시 비활성화 복원):
   ```
   // 현재 (임시):
   { /* TODO: GuestAnnotationOverlay 무한루프 수정 후 복원 */ }
   
   // 복원:
   {currentUserId && <GuestAnnotationOverlay userId={currentUserId} />}
   ```
5. App.tsx SessionPage의 디버그 로그도 제거:
   ```
   // 이 줄 제거:
   console.log("[SessionPage] DEBUG:", { isHost, currentUserId, ... });
   ```

### 완료 조건
- 게스트 탭에서 `/session/XXXX`에 진입 시 캔버스가 정상 표시됨
- 콘솔에 `Maximum update depth exceeded` 에러 없음
- `GuestAnnotationOverlay` 컴포넌트가 정상 렌더링됨

### 커밋
```bash
git add -A && git commit -m "[Fix-1] GuestAnnotationOverlay 무한 루프 수정"
```

### ⏸️ 여기서 멈추고 사용자에게 테스트 확인을 요청하세요.

---

## 단계 2: 마우스 필기 + 스마트펜 필기 동작 확인

### 목표
호스트와 게스트 모두 캔버스에서 마우스/스마트펜 필기가 정상 동작하는지 확인합니다.

### 작업 내용
1. 사용자에게 다음 테스트를 요청:
   - 호스트 탭: 캔버스에서 마우스로 그려보기
   - 게스트 탭: 캔버스에서 마우스로 그려보기
   - 호스트 탭: 스마트펜 연결 후 물리 노트에 필기
2. 문제가 있으면 콘솔 에러를 확인하여 추가 디버깅
3. 게스트에서 마우스 필기가 안 되는 경우 확인할 것:
   - `canInput` 값 확인: `SessionPage`에서 `isHost || selectedViewUserId === currentUserId`
   - 게스트의 `selectedViewUserId`가 `null`이면 `canInput = false` → 입력 불가
   - 필요시 조건 수정: `isHost || selectedViewUserId === currentUserId || selectedViewUserId === null`

### 완료 조건
- 호스트 캔버스에서 마우스로 필기 → 스트로크가 화면에 표시됨
- 게스트 캔버스에서 마우스로 필기 → 스트로크가 화면에 표시됨
- (스마트펜 있는 경우) 스마트펜 필기 → 캔버스에 실시간 표시

### 커밋 (수정 발생 시)
```bash
git add -A && git commit -m "[Fix-2] 마우스/스마트펜 필기 동작 수정"
```

### ⏸️ 여기서 멈추고 사용자에게 테스트 확인을 요청하세요.

---

## 단계 3: 호스트→게스트 스트로크 전송 추가

### 목표
호스트가 캔버스에 필기하면 게스트 화면에도 실시간으로 표시되도록 합니다.

### 작업 내용
1. `Client/Web/src/hooks/useDevBridgeHost.ts` 수정:
   - `useStrokeStore.subscribe`를 사용하여 호스트의 새 스트로크 감지
   - `devBridge.send({ type: 'STROKE_ADDED', stroke, code: sessionCode })` 전송
   - 기존 `handleStrokeAdded`에 자기 스트로크 무시 로직 추가 (안전장치)

2. `Client/Web/src/hooks/useDevBridgeGuest.ts` 수정:
   - `devBridge.on('STROKE_ADDED', ...)` 핸들러 추가
   - 자기 스트로크(`ownerUserId === guestUserId`)는 무시
   - 호스트 스트로크를 `useStrokeStore.getState().addHistoryStroke(event.stroke)`로 추가

### 주의사항
- `BroadcastChannel`은 자기 탭에서 보낸 메시지를 자기가 수신하지 않음 (브라우저 기본 동작)
- 그래도 안전장치로 자기 스트로크 무시 로직을 넣을 것
- cleanup에서 `unsubStroke()` 호출 잊지 말 것

### 완료 조건
- 호스트가 마우스로 필기 → 게스트 화면에 호스트 스트로크 표시됨
- 게스트가 마우스로 필기 → 호스트 화면에 게스트 스트로크 표시됨 (기존 동작 유지)

### 커밋
```bash
git add -A && git commit -m "[Fix-3] 호스트↔게스트 양방향 스트로크 전송 구현"
```

### ⏸️ 여기서 멈추고 사용자에게 테스트 확인을 요청하세요.

---

## 단계 4: 게스트 참가 시 호스트 화면에 노출

### 목표
게스트가 세션에 입장하면 호스트의 참가자 목록에 게스트가 표시되도록 합니다.

### 작업 내용
1. `Client/Web/src/App.tsx`의 `JoinPage` 함수에서 DEV 자동 참가 부분 수정:
   - `autoJoinAttempted.current = true;` 다음에 `devBridge.send({ type: 'GUEST_JOIN', ... })` 추가
   - 현재 GuestJoinPage에서는 GUEST_JOIN을 보내지만, JoinPage에서는 보내지 않음

2. JoinPage에서 `navigate` 직접 호출 추가 (useEffect 의존 제거):
   - `setSession()` 후 `navigate(`/session/${devSession.code}`, ...)` 직접 호출

### 완료 조건
- 게스트가 초대 링크로 입장 → 호스트 화면의 참가자 목록에 게스트 이름 표시됨

### 커밋
```bash
git add -A && git commit -m "[Fix-4] 게스트 참가 시 호스트에 GUEST_JOIN 이벤트 전송"
```

### ⏸️ 여기서 멈추고 사용자에게 테스트 확인을 요청하세요.

---

## 단계 5: 호스트→게스트 첨삭 모드 (Red Pen)

### 목표
호스트가 게스트 캔버스에 첨삭(빨간펜)하면 게스트 화면에도 표시되도록 합니다.

### 작업 내용
1. `Client/Web/src/components/host/RedPenAnnotation.tsx` 파일 확인
2. 호스트가 첨삭 스트로크를 완료할 때 devBridge로 전송:
   ```tsx
   devBridge.send({
     type: 'ANNOTATION_ADDED',
     targetUserId: targetGuestUserId,
     annotation: annotationStroke,
     code: sessionCode,
   });
   ```
3. 게스트 측 수신은 `useDevBridgeGuest`에 이미 `handleAnnotation` 구현됨
4. `GuestAnnotationOverlay`가 정상 동작하면 첨삭이 렌더링됨 (단계 1에서 수정 완료)

### 완료 조건
- 호스트가 게스트 캔버스에 빨간펜 첨삭 → 게스트 화면에 빨간 오버레이 표시됨

### 커밋
```bash
git add -A && git commit -m "[Fix-5] 호스트→게스트 첨삭 모드 구현"
```

### ⏸️ 여기서 멈추고 사용자에게 테스트 확인을 요청하세요.

---

## 단계 6: 최종 정리 및 통합 테스트

### 작업 내용
1. 남아있는 디버그 로그 모두 제거 (`console.log("[SessionPage] DEBUG"` 등)
2. 불필요한 주석 정리
3. 전체 시나리오 통합 테스트:

### 통합 테스트 체크리스트
- [ ] 호스트 세션 생성 → 입장
- [ ] 게스트 초대 링크로 세션 입장 → 캔버스 표시 (main과 동일)
- [ ] 게스트 입장 시 호스트 화면에 참가자 노출
- [ ] 호스트 마우스 필기 → 호스트 캔버스에 표시
- [ ] 호스트 마우스 필기 → 게스트 캔버스에 표시
- [ ] 게스트 마우스 필기 → 게스트 캔버스에 표시
- [ ] 게스트 마우스 필기 → 호스트 캔버스에 표시
- [ ] 스마트펜 연결 → 필기 → 캔버스에 실시간 표시
- [ ] 호스트 → 게스트 캔버스 첨삭(빨간펜) → 게스트 화면에 표시

### 커밋
```bash
git add -A && git commit -m "[Fix-6] 디버그 로그 정리 + 통합 테스트 완료"
git push origin feature/restructure-v2
```

### ⏸️ 여기서 멈추고 사용자에게 최종 확인을 요청하세요.

---

## 참고: 주요 파일 위치

| 파일 | 역할 |
|------|------|
| `Client/Web/src/App.tsx` | 라우팅, SessionPage, JoinPage, GuestJoinPage |
| `Client/Web/src/components/session/GuestAnnotationOverlay.tsx` | 게스트 첨삭 오버레이 (무한 루프 버그) |
| `Client/Web/src/components/host/HostSessionView.tsx` | 호스트 세션 뷰 (탭 UI) |
| `Client/Web/src/components/host/RedPenAnnotation.tsx` | 호스트 첨삭 기능 |
| `Client/Web/src/hooks/useDevBridgeHost.ts` | 호스트 브릿지 훅 |
| `Client/Web/src/hooks/useDevBridgeGuest.ts` | 게스트 브릿지 훅 |
| `Client/Web/src/services/dev-bridge.ts` | DEV 모드 탭간 통신 |
| `Client/Web/src/stores/session-store.ts` | 세션 상태 (isHost 판별) |
| `Client/Web/src/stores/stroke-store.ts` | 스트로크 상태 (⚠️ 수정 금지 - main 공유) |
| `Client/Web/src/stores/annotation-store.ts` | 첨삭 상태 |
| `Client/Web/src/components/canvas/*` | 캔버스 컴포넌트 (⚠️ 수정 금지 - main 공유) |
| `Client/Web/src/services/pen-input.service.ts` | 스마트펜 입력 (⚠️ 수정 금지 - main 공유) |
