# CLAUDE.md — NeoCast 재정비 프로젝트 필수 지침

> 이 파일은 Claude Code가 자동으로 읽는 프로젝트 지침서입니다.
> 모든 작업에서 반드시 따라야 합니다.

---

## 🚨 절대 규칙

### 1. main 브랜치 보호
- **main 브랜치에 직접 commit/push 절대 금지**
- 작업은 반드시 `feature/restructure-v2` 브랜치에서만 수행
- main의 실서버, 실DB에 연결하는 코드 작성 금지
- 환경변수(.env)에 실서버 정보 입력 금지

### 2. 단계별 작업 — 멈추고 확인받기
- **각 Phase/Step 완료 시 반드시 멈추고 사용자 확인을 받는다**
- 확인 없이 다음 단계로 넘어가지 않는다
- 완료 보고 시 다음을 포함한다:
  - 변경된 파일 목록
  - 무엇을 했는지 요약
  - 로컬에서 확인하는 방법
  - 다음 단계 예고

### 3. 기존 기능 보호 — 회귀 방지
- **새 기능 작업 시 기존에 정상 동작하던 기능을 깨뜨리지 않는다**
- 아래 회귀 방지 프로토콜을 반드시 따른다

---

## 🛡️ 회귀 방지 프로토콜

### 작업 전
1. 현재 정상 동작하는 기능 목록을 파악한다
2. 수정할 파일의 영향 범위를 먼저 분석한다
3. 공유 컴포넌트/유틸/스토어를 수정할 때는 해당 파일을 import하는 모든 곳을 확인한다

### 작업 중
4. **파일 삭제 대신 비활성화** — import 제거 또는 조건부 렌더링 사용
5. **기존 인터페이스(props, API 응답 구조) 변경 최소화** — 확장은 OK, 변경은 위험
6. **한 번에 하나의 기능만 작업** — 여러 기능을 동시에 건드리지 않는다
7. 기존 컴포넌트를 수정하기보다 **새 컴포넌트를 만들고 교체**하는 방식 선호

### 작업 후
8. 변경한 파일과 관련된 페이지/기능이 여전히 동작하는지 확인한다
9. TypeScript 컴파일 에러가 없는지 확인한다: `npx tsc --noEmit`
10. 빌드가 정상인지 확인한다: `npm run build`
11. 문제가 발견되면 새 기능 작업을 중단하고 먼저 수정한다

### 체크리스트 (매 Step 완료 시)
```
□ TypeScript 컴파일 에러 없음
□ 빌드 성공
□ 이전 단계에서 완료한 기능 정상 동작
□ 새로 추가한 기능 동작 확인
□ 콘솔에 에러/경고 없음
```

---

## 📋 프로젝트 컨텍스트

### 기획안
- 전체 기획: `neocast-restructure-plan-v4-final.md` 참조
- 기획안에 정의된 기능만 구현한다
- 기획안에 없는 기능은 임의로 추가하지 않는다

### 기술 스택 (main 기준)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, Zustand
- **Backend**: Node.js 20+, Fastify, Prisma, PostgreSQL, Redis
- **실시간**: Socket.IO (네임스페이스: /stroke, /control, /voice, /chat, /messenger)
- **인증**: JWT (Access + Refresh Token)
- **NCode**: wasm-pdf-core + SOBP 할당

### 폴더 구조 (main)
```
Client/Web/src/
├── components/    # React 컴포넌트
├── contexts/      # React Context
├── hooks/         # 커스텀 훅
├── pages/         # 라우트 페이지
├── services/      # API/서비스 레이어
├── stores/        # Zustand 스토어
├── types/         # TypeScript 타입
└── utils/         # 유틸리티

Server/src/
├── routes/        # Fastify REST API
├── services/      # 비즈니스 로직
├── socket/        # Socket.IO 핸들러
└── config/        # 설정
```

### 코딩 컨벤션
- TypeScript strict mode 준수
- 컴포넌트: 함수형 + hooks
- 상태관리: Zustand (기존 스토어 구조 따름)
- 스타일: Tailwind CSS (main 스타일 유지, dev의 수채화/글래스모피즘 미적용)
- API 호출: 기존 services/ 패턴 따름
- 네이밍: 기존 프로젝트 컨벤션 따름 (camelCase 변수, PascalCase 컴포넌트)

---

## 📦 작업 순서

### Phase 0: 사전 준비
```
0-1. main에서 feature/restructure-v2 브랜치 생성
0-2. Docker Compose + Prisma seed + 테스트 계정
0-3. 로그인 페이지 테스트 버튼 추가
0-4. 메신저/음성통화 비활성화 (삭제 ❌, 숨김 처리)
→ 완료 후 멈추고 확인
```

### Phase 1: 호스트 메뉴 개편
```
1-1. LNB 재구성 (홈/세션목록/워크시트/수업결과)
→ 멈추고 확인

1-2. 홈 화면 (대시보드 + 세션 만들기 모달)
→ 멈추고 확인

1-3. 세션 목록 페이지
→ 멈추고 확인

1-4. 내 워크시트 페이지
→ 멈추고 확인

1-5. 수업 결과 페이지 (dev 이식)
→ 멈추고 확인
```

### Phase 2: 호스트 세션 화면
```
2-1. 기본 뷰 / 참가자 모드 뷰 탭 추가
→ 멈추고 확인

2-2. 참가자 모드 뷰 (모니터링 + 첨삭) dev 이식
→ 멈추고 확인

2-3. 필기중 뱃지 추가
→ 멈추고 확인
```

### Phase 3: 게스트 화면
```
3-1. 첨삭 수신 모드 (dev Red Pen 이식)
→ 멈추고 확인
```

---

## ⚠️ 비활성화 대상 (삭제 금지)

다음 기능은 코드를 삭제하지 않고 비활성화만 한다:
- 메신저 (DM, 친구관리, 프레즌스) → LNB 숨김, 라우트 비활성화
- 음성 통화 (WebRTC) → 비활성화
- 알림 → 미구현

비활성화 방법:
```tsx
// ✅ 좋은 예: 조건부 렌더링
{FEATURE_FLAGS.MESSENGER_ENABLED && <MessengerPanel />}

// ✅ 좋은 예: 라우트 주석 또는 조건부
// { path: '/messenger', element: <MessengerPage /> },  // 비활성화

// ❌ 나쁜 예: 파일/코드 삭제
```

---

## 🔍 이식 참조

dev 브랜치에서 이식할 때:
1. dev의 컴포넌트 로직만 참고한다
2. main의 API/인증/스토어 구조에 맞게 재작성한다
3. dev의 인메모리 로직은 Prisma/REST API 호출로 교체한다
4. dev의 Socket.IO 이벤트는 main의 네임스페이스 구조에 맞춘다

---

## 💬 커밋 컨벤션

```
[Phase X-Y] 작업 내용 요약

예시:
[Phase 0-2] Docker Compose + Prisma seed 스크립트 추가
[Phase 1-1] LNB 재구성 — 홈/세션목록/워크시트/수업결과
[Phase 2-2] 참가자 모니터링 뷰 이식 (dev Session 8-2)
```

---

## 📝 완료 보고 템플릿

각 단계 완료 시 아래 형식으로 보고한다:

```
## [Phase X-Y] 완료 보고

### 변경 사항
- 변경/추가된 파일 목록

### 작업 내용
- 무엇을 했는지 간단 요약

### 확인 방법
- 로컬에서 어떻게 테스트하는지

### 회귀 체크
- □ TypeScript 컴파일 OK
- □ 빌드 OK
- □ 이전 기능 정상
- □ 콘솔 에러 없음

### 다음 단계
- 다음에 할 작업 예고
```
