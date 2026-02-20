# 게스트 모드 기능 구현

## 변경 일자
2026-01-12

## 변경 요약
로그인 없이 초대 링크로 세션에 참가할 수 있는 게스트 모드 기능을 구현했습니다. 세션 생성 시 게스트 모드를 활성화하면 초대받은 사용자가 계정 없이도 세션에 참여할 수 있습니다.

## 변경된 파일

### 프론트엔드 (PenStreamClient/Web)
- **src/App.tsx**:
  - GuestJoinPage 컴포넌트 추가 (게스트 참가 UI)
  - 로그인 페이지에 "로그인 없이 참가" 버튼 추가
  - 게스트가 새 초대 링크 접속 시 자동 로그아웃 처리
  - Toast 메시지를 글로벌 위치로 이동 및 "복사되었습니다"로 통일

- **src/components/session/SessionLobby.tsx**:
  - "게스트 모드" 체크박스 추가 (기본값: 체크됨)

- **src/services/session-service.ts**:
  - `allowGuestMode` 옵션 추가
  - `joinAsGuest()` API 메서드 추가

- **src/stores/auth-store.ts**:
  - `isGuest` 상태 추가
  - `loginAsGuest()` 액션 추가
  - 게스트 세션은 localStorage에 저장하지 않도록 수정

### 백엔드 (PenStreamServer)
- **prisma/schema.prisma**:
  - User 모델에 `isGuest` 필드 추가
  - Session 모델에 `allowGuestMode` 필드 추가

- **src/services/session.service.ts**:
  - `generateGuestId()`: @guest-N 형식의 게스트 ID 생성 (Redis 카운터 사용)
  - `createGuestUser()`: 게스트 사용자 생성
  - `joinSessionAsGuest()`: 게스트로 세션 참가

- **src/routes/sessions.ts**:
  - `/join-as-guest` 엔드포인트 추가 (인증 불필요)

## 상세 내용

### 게스트 참가 흐름
1. 호스트가 세션 생성 시 "게스트 모드" 체크박스 활성화
2. 초대 링크를 받은 사용자가 접속하면 로그인 화면 표시
3. "로그인 없이 참가" 버튼 클릭 시 게스트 참가 화면으로 이동
4. 표시 이름 입력 (선택사항, 기본값: @guest-N)
5. 세션 참가 완료

### 게스트 세션 특징
- 게스트 ID는 `@guest-1`, `@guest-2` 형식으로 순차 생성
- 게스트 세션은 브라우저에 저장되지 않음 (새로고침 시 초기화)
- 새 초대 링크 접속 시 기존 게스트 세션 자동 로그아웃
- 게스트도 자신의 캔버스에 필기 가능 (실제 UUID로 인증)

### UX 개선
- 복사 버튼 클릭 시 "복사되었습니다" 메시지 1초간 표시
- Toast 메시지가 모든 위치에서 표시되도록 글로벌 위치로 이동
