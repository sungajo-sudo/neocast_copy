# 지우개 버그 수정, 스마트펜 좌표 필터링, 마우스 점 찍기, 참가자 퇴출 기능

## 변경 일자
2026-02-10

## 변경 요약
지우개가 모든 캔버스에 적용되던 버그 수정, 스마트펜 원점 좌표 필터링,
마우스 클릭으로 점 찍기 지원, 호스트가 참가자를 세션에서 내보내는 기능 추가.

## 핵심 변경 사항

### 1. 지우개 캔버스 격리 (버그 수정)
- **문제**: 지우개가 같은 페이지에 있는 모든 사용자의 스트로크를 지움
- **원인**: 지우개가 `pageAddress`만으로 대상을 찾고 `ownerUserId`를 비교하지 않음
- **수정**: 3개 지우개 코드 경로(`addPoint`, `addPoints`, `applyEraserStroke`)에 `ownerUserId` 일치 조건 추가
- **부수 수정**: undo/redo 스택 키가 `pageKey` 대신 `ownerKey`를 사용하도록 수정 (기존에는 항상 불일치하여 undo 정리가 동작하지 않았음)

### 2. 스마트펜 원점 좌표 필터링
- **문제**: 스마트펜에서 Ncode 좌표 (0,0) 부근의 무효 점이 입력됨
- **수정**: `pen-input.service.ts`의 PenMove 처리에서 `dot.x < 1 && dot.y < 1`인 경우 무시

### 3. 마우스 단일 클릭 점 찍기
- **문제**: MouseDown → MouseUp (Move 없이)인 경우 1포인트 스트로크가 화면에 표시되지 않음
- **원인**: `renderStroke`에서 `points.length < 2`면 렌더링 스킵
- **수정**: 1포인트 스트로크일 때 `ctx.arc()`로 원(점) 렌더링

### 4. 참가자 퇴출(내보내기) 기능
- **Server**: `kickParticipant()` 서비스 + `POST /:id/kick/:userId` 라우트 + `broadcastParticipantKick()` 소켓 함수
- **Client**: 참가자 햄버거 메뉴에 "내보내기" 항목 추가 (확인 다이얼로그 포함)
- **퇴출 흐름**: 호스트 → API 요청 → DB leftAt 설정 → PARTICIPANT_KICKED 브로드캐스트 → 킥된 사용자 소켓 강제 해제 → 클라이언트에서 알림 표시 후 로비 이동
- **재참가 가능**: 퇴출된 사용자는 세션 코드/링크로 다시 입장 가능
- **i18n**: 15개 언어에 `kick`, `kickConfirm`, `kickedMessage` 키 추가

## 변경된 파일

### Client 수정
- `stores/stroke-store.ts`: 지우개 ownerUserId 체크 + undo/redo 키 수정
- `services/pen-input.service.ts`: PenMove 원점 좌표 필터링
- `components/canvas/StrokeCanvas.tsx`: 1포인트 스트로크 점 렌더링
- `components/session/ParticipantList.tsx`: 내보내기 메뉴 항목 + 핸들러
- `stores/session-store.ts`: kicked 상태 + setKicked 액션
- `stores/connection-store.ts`: PARTICIPANT_KICKED 이벤트 핸들러
- `services/session-service.ts`: kickParticipant() 메서드
- `App.tsx`: kicked 감지 → 알림 + 로비 이동

### Server 수정
- `services/session.service.ts`: kickParticipant() 함수
- `socket/index.ts`: broadcastParticipantKick() 함수
- `routes/sessions.ts`: POST /:id/kick/:userId 라우트

### i18n (15개 언어)
- `en-US`, `en-GB`, `ko`, `ja`, `zh-CN`, `zh-TW`, `de`, `es`, `fr`, `ar`, `th`, `fil`, `id`, `ms`, `vi`
