# React Router 구현 및 페이지 추가/삭제 동기화

## 변경 일자
2026-01-12

## 변경 요약
브라우저의 뒤로/앞으로 버튼 지원을 위한 React Router 도입과 페이지 추가/삭제 기능의 서버 동기화 구현

## 변경된 파일

### 클라이언트 (PenStreamClient/Web)

- **package.json, package-lock.json**: react-router-dom 패키지 추가
- **src/main.tsx**: BrowserRouter 래퍼 추가
- **src/App.tsx**:
  - React Router 기반 라우팅 구조 전면 개편
  - RequireAuth 인증 래퍼 컴포넌트 추가
  - LoginPage, SignupPage, LobbyPage, JoinPage, SessionPage 페이지 컴포넌트 분리
  - 라우트 정의: `/login`, `/signup`, `/`, `/join/:code`, `/session/:code`
  - 사이드바를 세션 페이지에서만 표시하도록 변경
  - 로그인 전 아바타 아이콘 추가 (텍스트 제거)
- **src/components/auth/AuthPanel.tsx**: initialMode prop 추가 (login/signup 모드 지정)
- **src/components/toolbar/PageNavigation.tsx**:
  - 페이지 삭제 컨텍스트 메뉴 추가 (우클릭)
  - strokeService.addPage() 호출로 서버 동기화
- **src/types/index.ts**:
  - MessageType.HistoryPage (0xf4) 추가
  - PageType enum 추가 (Blank, Lined, Grid, Dot)
- **src/protocol/messages.ts**:
  - createPageAdd(), createPageDelete() 메시지 생성 함수 추가
  - parsePageAdd(), parsePageDelete(), parseHistoryPage() 파싱 함수 추가
- **src/services/stroke-service.ts**:
  - addPage(), deletePage() 메서드 추가
  - PAGE_ADD, PAGE_DELETE, HISTORY_PAGE 메시지 핸들링
- **src/stores/page-store.ts**: deletePage() 액션 추가

### 서버 (PenStreamServer)

- **prisma/schema.prisma**: Page 모델 추가 (세션별 페이지 정보 저장)
- **src/protocol/types.ts**: HISTORY_PAGE (0xf4) 메시지 타입 추가
- **src/protocol/messages.ts**: buildHistoryPageMessage() 함수 추가
- **src/services/stroke.service.ts**:
  - handlePageAdd(), handlePageDelete() 핸들러 추가
  - 히스토리 동기화에 페이지 정보 포함 (HISTORY_PAGE 메시지 전송)

## 상세 내용

### 1. React Router 도입
- 브라우저 네비게이션 히스토리 지원 (뒤로/앞으로 버튼)
- URL 기반 상태 관리로 북마크/공유 가능
- 인증 보호 라우트 (RequireAuth)로 미로그인 시 /login 리다이렉트

### 라우트 구조
| 경로 | 설명 | 인증 필요 |
|------|------|----------|
| `/login` | 로그인 페이지 | X |
| `/signup` | 회원가입 페이지 | X |
| `/` | 세션 로비 (생성/참가) | O |
| `/join/:code` | 초대 링크 참가 | O |
| `/session/:code` | 활성 세션 (캔버스) | O |

### 2. 페이지 추가/삭제 동기화
- 페이지 추가 시 서버에 PAGE_ADD 메시지 전송 → DB 저장
- 페이지 삭제 시 서버에 PAGE_DELETE 메시지 전송 → DB에서 페이지 및 스트로크 삭제
- 다른 참가자에게 실시간 브로드캐스트
- 세션 재참가 시 HISTORY_PAGE 메시지로 페이지 정보 복원

### 3. UI 개선
- 로그인 뱃지에서 "Login" 텍스트 제거, 아바타 아이콘만 표시
- 세션 페이지가 아닌 화면에서 사이드바 숨김
- 페이지 우클릭 시 삭제 메뉴 표시
