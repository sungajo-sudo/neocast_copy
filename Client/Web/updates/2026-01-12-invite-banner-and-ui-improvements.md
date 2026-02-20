# 초대 배너 및 UI 개선

## 변경 일자
2026-01-12

## 변경 요약
호스트가 혼자일 때 참가자 초대를 유도하는 배너 기능 추가, NeoCAST 로고 리디자인, 반응형 UI 개선 등 사용자 경험을 크게 향상시켰습니다.

## 변경된 파일

### 클라이언트 (PenStreamClient/Web)

- **src/App.tsx**:
  - 초대 배너 구현 (호스트가 혼자일 때 표시)
  - 배너 닫기 기능 및 10회 닫기 시 영구 비활성화 옵션
  - NeoCAST 로고 리디자인 (그라데이션 텍스트 + 상태 도트)
  - 세션 배지 반응형 개선
  - 패널 축소 브레이크포인트 변경 (768px → 1280px)

- **src/index.css**:
  - 초대 배너용 pulse-slow 애니메이션 추가

- **src/components/canvas/CanvasContainer.tsx**:
  - 그리드 뷰 새로고침 버그 수정 (pages 구독 방식 변경)

- **src/components/session/ParticipantList.tsx**:
  - 반응형 브레이크포인트 변경 (md → xl)
  - 호스트 승격/강등 기능 추가
  - 오프라인 표시 기능 추가

- **src/components/toolbar/PageNavigation.tsx**:
  - 반응형 브레이크포인트 변경 (md → xl)
  - PAGE_ADD에 ownerUserId 추가

- **src/components/session/SessionLobby.tsx**:
  - 세션 재연결 기능 추가

- **src/protocol/messages.ts**:
  - PAGE_ADD 메시지에 ownerUserId 필드 추가

- **src/services/session-service.ts**:
  - reconnect, promote, demote API 추가

- **src/services/stroke-service.ts**:
  - 자동 네비게이션을 단일 사용자 뷰에서만 동작하도록 변경
  - PAGE_ADD에 ownerUserId 처리 추가

- **src/stores/connection-store.ts**:
  - HOST_DISCONNECTED, HOST_RECONNECTED 이벤트 핸들러 추가

- **src/stores/page-store.ts**:
  - initializeForUser가 address 반환하도록 수정

- **src/stores/session-store.ts**:
  - isOnline 상태 관리 추가
  - 다중 호스트 지원

- **src/types/index.ts**:
  - Participant에 isOnline 필드 추가

### 서버 (PenStreamServer)

- **src/protocol/messages.ts**:
  - PAGE_ADD 메시지에 ownerUserId 필드 추가

- **src/routes/sessions.ts**:
  - reconnectable, reconnect, promote, demote 엔드포인트 추가

- **src/services/session.service.ts**:
  - 다중 호스트 지원
  - 재연결 기능 구현
  - handleParticipantDisconnect 로직 개선

- **src/services/stroke.service.ts**:
  - PAGE_ADD ownerUserId 처리

- **src/socket/namespaces/control.ns.ts**:
  - HOST_DISCONNECTED, HOST_RECONNECTED 이벤트 emit

## 상세 내용

### 초대 배너 기능
- 호스트가 세션에 혼자 있을 때 화면 하단 중앙에 초대 배너 표시
- "참가자를 초대하세요. 참석자는 초대링크로 참가할 수 있습니다" 메시지
- 링크 복사 버튼으로 초대 URL 복사 가능
- X 버튼으로 닫기 가능
- 10회 누적 닫기 시 영구 비활성화 옵션 제공
- 반응형: 700px 이하에서 부가 텍스트 숨김, 380px 이하에서 주요 텍스트도 숨김

### NeoCAST 로고 리디자인
- "Neo" 텍스트: 파란색→보라색 그라데이션
- "CAST" 텍스트: 회색
- 연결 상태 표시 도트: 연결 시 녹색(ping 애니메이션), 미연결 시 빨간색
- 모바일에서는 그라데이션 배경의 방송 아이콘으로 표시

### 반응형 브레이크포인트 개선
- 참가자 목록, 페이지 네비게이션의 md → xl 브레이크포인트 변경
- 더 넓은 화면에서 더 많은 정보 표시

### 호스트 재연결 및 다중 호스트
- 호스트 연결 끊김 시 일정 시간 내 재연결 가능
- 다중 호스트 지원으로 호스트 승격/강등 가능
