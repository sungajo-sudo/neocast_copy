# NeoCAST

**실시간 스마트펜 스트리밍 및 협업 플랫폼**

NeoCAST는 네오랩컨버전스의 스마트펜을 활용한 실시간 필기 공유 및 협업 플랫폼입니다. 교육, 회의, 원격 협업 등 다양한 환경에서 스마트펜으로 작성한 내용을 실시간으로 공유하고 협업할 수 있습니다.

---

## 재정비 진행 현황 (feature/restructure-v2)

> 브랜치: `feature/restructure-v2` | 기준 기획안: `neocast-restructure-plan-v4-final.md`

### Phase 진행 상태

| Phase | 항목 | 상태 | 커밋 |
|-------|------|------|------|
| 0 | 프로젝트 지침 및 기획안 배치 | ✅ 완료 | `b348622` |
| 0 | Docker Compose + Prisma seed + 테스트 계정 + 기능 비활성화 | ✅ 완료 | `f7d50eb` |
| 1-1 | LNB 재구성 (홈/세션목록/워크시트/수업결과) | ✅ 완료 | `1dfb83c` |
| 1-2 | 홈 화면 — 대시보드 + 세션 만들기 모달 (DEV mock 포함) | ✅ 완료 | `1a747f6` |
| 1-3 | 세션 목록 페이지 | ⬜ 미완료 | — |
| 1-4 | 내 워크시트 페이지 | ⬜ 미완료 | — |
| 1-5 | 수업 결과 페이지 | ⬜ 미완료 | — |
| 2-1 | 호스트 세션 화면 — 기본 뷰 / 참가자 모드 뷰 탭 | ✅ 완료 | `7f11fa8` |
| 2-2 | 참가자 모드 뷰 — 모니터링 그리드 + 빨간펜 첨삭 | ✅ 완료 | `b71ac49` |
| 2-2 | DEV 브릿지 — 멀티탭 게스트 참가 + 첨삭 통신 테스트 | ✅ 완료 | `195a7b4` |
| 2-3 | 필기중 뱃지 (학생 카드에 실시간 표시) | ⬜ 미완료 | — |
| 3-1 | 게스트 화면 첨삭 수신 뷰 | ✅ 완료 (기본) | `195a7b4` |

### 구현된 주요 기능

#### 호스트 화면
- **LNB**: 홈 / 세션 목록 / 워크시트 / 수업 결과 메뉴 구성
- **홈 대시보드**: 최근 세션 요약 + 세션 만들기 모달
- **세션 만들기**: 수업 제목·인원·비밀번호·게스트 허용 설정 (DEV mock 지원)
- **뷰 탭**: 기본 뷰(캔버스) ↔ 참가자 모드 뷰 전환
- **참가자 모니터링 그리드**: 학생별 미니 캔버스 카드 + 필기 실시간 표시
- **빨간펜 첨삭**: 학생 카드 클릭 → 상세 모달 → 드래그로 첨삭 전송

#### 게스트(학생) 화면
- **초대 링크 참가**: DEV 브릿지로 백엔드 없이 멀티탭 테스트 가능
- **첨삭 수신**: 호스트 첨삭이 화면에 빨간 선으로 오버레이 표시

#### DEV 모드 (백엔드 없이 테스트)
- **BroadcastChannel 브릿지** (`services/dev-bridge.ts`)
- 호스트 탭 → 세션 생성 → 초대 링크 복사
- 게스트 탭 → 링크 열기 → 이름 입력 → 참가
- 게스트 필기 → 호스트 모니터링 그리드에 실시간 반영
- 호스트 첨삭 → 게스트 화면에 오버레이 표시

### 비활성화된 기능 (코드 보존, UI 숨김)
- 메신저 / DM / 친구 관리 (`MESSENGER_ENABLED: false`)
- 음성 통화 WebRTC (`VOICE_ENABLED: false`)

### 로컬 DEV 테스트 방법

```bash
# 클라이언트만 실행 (백엔드 불필요)
cd Client/Web && npm run dev
# → http://localhost:5173 (또는 5174, 7191 등 사용 가능한 포트)
```

**멀티탭 시나리오 (2개 탭으로 테스트)**

1. **탭 1 (호스트)**: 로그인(테스트: host@abc.com / 1234) → 세션 만들기 → 초대 링크 복사
2. **탭 2 (게스트)**: 복사한 링크 열기 → 이름 입력 → 참가하기
3. **탭 2**: 마우스로 캔버스에 필기
4. **탭 1**: 참가자 모드 뷰 탭 클릭 → 게스트 카드에 필기 반영 확인
5. **탭 1**: 카드 클릭 → 첨삭 모드 ON → 드래그로 첨삭
6. **탭 2**: 빨간 선 첨삭 표시 확인

---

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [시스템 요구사항](#시스템-요구사항)
- [설치 및 실행](#설치-및-실행)
- [환경변수 설정](#환경변수-설정)
- [프로젝트 구조](#프로젝트-구조)
- [아키텍처](#아키텍처)
- [API 문서](#api-문서)
- [Socket.IO 네임스페이스](#socketio-네임스페이스)
- [데이터베이스 스키마](#데이터베이스-스키마)
- [NCode PDF 생성](#ncode-pdf-생성)
- [다국어 지원](#다국어-지원)
- [배포](#배포)

---

## 주요 기능

### 1. 실시간 스마트펜 스트리밍
- 네오 스마트펜과 연결하여 실시간으로 필기 내용 전송
- 마우스/터치 입력도 지원
- 바이너리 프로토콜을 통한 고성능 스트로크 데이터 전송
- 페이지별 스트로크 관리 및 Undo/Redo 지원

### 2. 세션 관리
- 6자리 코드 기반 세션 생성 및 참가
- 호스트/게스트 역할 구분
- 초대 링크 및 비밀번호 보호
- 게스트 모드 (로그인 없이 참가 가능)
- 세션 자동 아카이브

### 3. NCode PDF 생성 시스템
- PDF에 NCode 패턴 적용 (wasm-pdf-core 사용)
- NPROJ 파일 자동 생성 (WebCaster v2.31 호환)
- 청사진(파란색) 변환 옵션
- 이용자별 SOBP (Section.Owner.Book.Page) 할당
- IndexedDB 기반 로컬 캐시 (오프라인 지원)

### 4. 채팅 및 메신저
- 세션 내 실시간 그룹 채팅
- 친구 간 1:1 다이렉트 메시지
- 타이핑 인디케이터
- 프레즌스 (온라인/자리비움/바쁨)
- 메시지 읽음 확인

### 5. 친구 관리
- 이메일 기반 사용자 검색
- 친구 요청/수락/거절
- 친구 그룹 관리
- 관계 플래그 (친구, 선생님, 학생, 부모, 자녀)

### 6. 음성 통화
- WebRTC 기반 실시간 음성 통화
- 음소거/음소거 해제

### 7. 파일 공유
- 채팅 내 파일 첨부
- 로컬/GCS 스토리지 지원

---

## 기술 스택

### Frontend (Client/Web)
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.2 | UI 프레임워크 |
| TypeScript | 5.9 | 타입 안정성 |
| Vite | 7.2 | 빌드 도구 |
| Tailwind CSS | 4.1 | 스타일링 |
| Zustand | 5.0 | 상태 관리 |
| Socket.IO Client | 4.8 | 실시간 통신 |
| React Router | 7.12 | 라우팅 |
| i18next | 25.7 | 다국어 지원 |
| pdf-lib | 1.17 | PDF 조작 |
| pdfjs-dist | 4.10 | PDF 렌더링 |

### Backend (Server)
| 기술 | 버전 | 용도 |
|------|------|------|
| Node.js | 20+ | 런타임 |
| Fastify | 4.28 | HTTP 서버 |
| Socket.IO | 4.7 | 실시간 통신 |
| Prisma | 5.17 | ORM |
| PostgreSQL | - | 데이터베이스 |
| Redis | - | 캐시/Pub-Sub |
| @google-cloud/storage | 7.18 | GCS 스토리지 |
| Pino | 9.3 | 로깅 |
| Zod | 3.23 | 스키마 검증 |

---

## 시스템 요구사항

### 개발 환경
- Node.js 20.0.0 이상
- PostgreSQL 15 이상
- Redis 7 이상
- npm 또는 yarn

### 프로덕션 환경
- Docker 및 Docker Compose (권장)
- GCS 버킷 (파일 스토리지용, 선택)

---

## 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/neolab/NeoCAST.git
cd NeoCAST
```

### 2. 서버 설정

```bash
cd Server

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 필요한 값 설정

# Prisma 클라이언트 생성
npm run db:generate

# 데이터베이스 마이그레이션
npm run db:migrate

# 개발 서버 실행
npm run dev
```

### 3. 클라이언트 설정

```bash
cd Client/Web

# 의존성 설치
npm install

# 개발 서버 실행 (기본 포트: 5173)
npm run dev
```

### 4. 서비스 접속

- 클라이언트: http://localhost:5173
- API 서버: http://localhost:8190

---

## 환경변수 설정

### Server/.env

```bash
# 서버 설정
PORT=8190
HOST=0.0.0.0
NODE_ENV=development

# 데이터베이스
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/penstreamdb?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT 인증
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# 세션 설정
SESSION_CODE_LENGTH=6
MAX_GUESTS_PER_SESSION=100

# 로깅
LOG_LEVEL=info

# CORS (프로덕션)
CORS_ORIGINS=""

# 스토리지 (local 또는 gcs)
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./storage

# GCS 설정 (STORAGE_TYPE=gcs인 경우)
# GCS_PROJECT_ID=neocast-local
# GCS_BUCKET_PREFIX=neocast-dev
# GCS_EMULATOR_HOST=http://localhost:4443
```

### Client/Web 환경변수

Vite 환경변수는 `VITE_` 접두사를 사용합니다:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8190/api
VITE_SOCKET_URL=http://localhost:8190
```

---

## 프로젝트 구조

```
NeoCAST/
├── Client/
│   └── Web/                    # React 웹 클라이언트
│       ├── public/             # 정적 파일
│       ├── src/
│       │   ├── components/     # React 컴포넌트
│       │   │   ├── auth/       # 인증 UI
│       │   │   ├── canvas/     # 드로잉 캔버스
│       │   │   ├── control-bar/# 하단 컨트롤 바
│       │   │   ├── dialogs/    # 다이얼로그
│       │   │   ├── layout/     # 레이아웃
│       │   │   ├── messenger/  # 메신저 UI
│       │   │   ├── panels/     # 사이드 패널
│       │   │   ├── pen/        # 스마트펜 연결
│       │   │   ├── session/    # 세션 관리
│       │   │   └── toolbar/    # 펜 도구
│       │   ├── contexts/       # React Context
│       │   ├── hooks/          # 커스텀 훅
│       │   ├── i18n/           # 다국어 리소스
│       │   ├── pages/          # 라우트 페이지
│       │   ├── protocol/       # 바이너리 프로토콜
│       │   ├── services/       # 서비스 레이어
│       │   ├── stores/         # Zustand 스토어
│       │   ├── types/          # TypeScript 타입
│       │   ├── utils/          # 유틸리티
│       │   └── workers/        # Web Workers
│       ├── package.json
│       └── vite.config.ts
│
├── Server/
│   ├── prisma/
│   │   └── schema.prisma       # 데이터베이스 스키마
│   ├── src/
│   │   ├── config/             # 설정
│   │   ├── db/                 # 데이터베이스 연결
│   │   ├── protocol/           # 바이너리 프로토콜
│   │   ├── routes/             # REST API 라우트
│   │   │   ├── auth.ts         # 인증
│   │   │   ├── sessions.ts     # 세션 관리
│   │   │   ├── archives.ts     # 아카이브
│   │   │   ├── nc-paperhub.ts  # NCode PDF 관리
│   │   │   ├── friends.ts      # 친구 관리
│   │   │   ├── messages.ts     # DM 메시지
│   │   │   └── ...
│   │   ├── services/           # 비즈니스 로직
│   │   │   ├── auth.service.ts
│   │   │   ├── session.service.ts
│   │   │   ├── stroke.service.ts
│   │   │   ├── nc-paperhub.service.ts
│   │   │   ├── friend.service.ts
│   │   │   ├── message.service.ts
│   │   │   └── storage/        # 스토리지 프로바이더
│   │   ├── socket/             # Socket.IO
│   │   │   ├── index.ts
│   │   │   ├── middleware/
│   │   │   └── namespaces/     # 네임스페이스 핸들러
│   │   └── utils/              # 유틸리티
│   └── package.json
│
├── docs/                       # 문서
├── scripts/                    # 스크립트
├── CLAUDE.md                   # Claude 가이드라인
└── README.md
```

---

## 아키텍처

### 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client (React)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Stores    │  │  Services   │  │ Components  │  │      i18n           │ │
│  │  (Zustand)  │  │ (Business)  │  │   (React)   │  │   (15 languages)    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │               │                │                                   │
│         └───────────────┼────────────────┘                                   │
│                         │                                                    │
│              ┌──────────┴──────────┐                                        │
│              │    Socket.IO +      │                                        │
│              │      REST API       │                                        │
│              └──────────┬──────────┘                                        │
└─────────────────────────┼───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Server (Fastify)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┐    ┌───────────────────────────────────────┐ │
│  │      REST API Routes      │    │         Socket.IO Namespaces          │ │
│  ├───────────────────────────┤    ├───────────────────────────────────────┤ │
│  │ /api/auth                 │    │ /stroke   - 스트로크 데이터           │ │
│  │ /api/sessions             │    │ /control  - 세션 제어                 │ │
│  │ /api/archives             │    │ /voice    - 음성 통화                 │ │
│  │ /api/nc-paperhub          │    │ /chat     - 세션 채팅                 │ │
│  │ /api/friends              │    │ /messenger- DM + 프레즌스             │ │
│  │ /api/messages             │    └───────────────────────────────────────┘ │
│  │ /api/files                │                                              │
│  └───────────────────────────┘                                              │
│                   │                                                          │
│  ┌────────────────┴────────────────┐                                        │
│  │         Service Layer           │                                        │
│  │  (Business Logic + Validation)  │                                        │
│  └────────────────┬────────────────┘                                        │
│                   │                                                          │
│  ┌────────────────┼────────────────┬───────────────────┐                    │
│  ▼                ▼                ▼                   ▼                    │
│ ┌──────┐    ┌──────────┐    ┌───────────┐    ┌─────────────────┐           │
│ │Prisma│    │  Redis   │    │  Storage  │    │   NDP Router    │           │
│ │ ORM  │    │Pub/Sub   │    │Local/GCS  │    │ (Paper Lookup)  │           │
│ └──┬───┘    └────┬─────┘    └─────┬─────┘    └─────────────────┘           │
└────┼─────────────┼────────────────┼─────────────────────────────────────────┘
     │             │                │
     ▼             ▼                ▼
┌──────────┐  ┌─────────┐    ┌───────────┐
│PostgreSQL│  │  Redis  │    │Local/GCS  │
│   DB     │  │  Cache  │    │  Storage  │
└──────────┘  └─────────┘    └───────────┘
```

### 데이터 흐름

```
스마트펜 입력 → PenInputService → StrokeStore → Socket.IO(/stroke)
                                       │
                                       ▼
                              StrokeCanvas (렌더링)
                                       │
                                       ▼
                           다른 참가자에게 브로드캐스트
```

---

## API 문서

### 인증 (Auth)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/refresh` | 토큰 갱신 |
| POST | `/api/auth/logout` | 로그아웃 |
| POST | `/api/auth/guest` | 게스트 토큰 발급 |
| GET | `/api/auth/me` | 현재 사용자 정보 |

### 세션 (Sessions)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/sessions` | 세션 생성 |
| GET | `/api/sessions/:id` | 세션 정보 조회 |
| POST | `/api/sessions/join` | 세션 참가 |
| POST | `/api/sessions/:id/leave` | 세션 나가기 |
| DELETE | `/api/sessions/:id` | 세션 종료 |
| GET | `/api/sessions/:id/strokes` | 스트로크 조회 |

### NcPaperHub (NCode PDF 관리)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/nc-paperhub/allocate` | SOBP 할당 |
| POST | `/api/nc-paperhub/attach` | PDF + NPROJ 업로드 |
| GET | `/api/nc-paperhub/papers` | 사용자 페이퍼 목록 |
| GET | `/api/nc-paperhub/paper/:id` | 페이퍼 상세 |
| GET | `/api/nc-paperhub/paper/:id/pdf` | PDF 다운로드 |
| GET | `/api/nc-paperhub/paper/:id/nproj` | NPROJ 다운로드 |
| GET | `/api/nc-paperhub/paper/:id/compound` | NP2 파일 다운로드 |
| DELETE | `/api/nc-paperhub/paper/:id` | 페이퍼 삭제 |
| POST | `/api/nc-paperhub/lookup` | SOBP로 페이퍼 조회 |

### 친구 관리 (Friends)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/friends` | 친구 목록 |
| GET | `/api/friends/search` | 이메일로 사용자 검색 |
| POST | `/api/friends/request` | 친구 요청 전송 |
| GET | `/api/friends/requests` | 받은 친구 요청 |
| GET | `/api/friends/requests/sent` | 보낸 친구 요청 |
| POST | `/api/friends/requests/:id/accept` | 친구 요청 수락 |
| POST | `/api/friends/requests/:id/reject` | 친구 요청 거절 |
| DELETE | `/api/friends/:id` | 친구 삭제 |

### 메시지 (Messages)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/messages/threads` | DM 대화 목록 |
| GET | `/api/messages/threads/:id` | 특정 대화 메시지 |
| POST | `/api/messages/start` | 대화 시작 |
| GET | `/api/messages/unread-count` | 읽지 않은 메시지 수 |

---

## Socket.IO 네임스페이스

### /stroke - 스트로크 데이터

실시간 필기 데이터 전송을 담당합니다.

**이벤트**
- `stroke:data` - 스트로크 데이터 전송/수신 (바이너리)
- `stroke:sync` - 페이지 동기화 요청
- `stroke:clear` - 페이지 클리어
- `stroke:undo` / `stroke:redo` - 실행 취소/재실행

### /control - 세션 제어

세션 상태 변경 및 제어 메시지를 전송합니다.

**이벤트**
- `control:join` - 세션 참가
- `control:leave` - 세션 나가기
- `control:page-change` - 페이지 변경
- `control:role-change` - 역할 변경

### /voice - 음성 통화

WebRTC 시그널링을 담당합니다.

**이벤트**
- `voice:offer` / `voice:answer` - SDP 교환
- `voice:ice-candidate` - ICE 후보 교환
- `voice:mute` / `voice:unmute` - 음소거 상태

### /chat - 세션 채팅

세션 내 실시간 그룹 채팅을 담당합니다.

**이벤트**
- `chat:message` - 메시지 전송/수신
- `chat:history` - 채팅 기록 로드
- `chat:typing` - 타이핑 인디케이터
- `chat:dm` - 다이렉트 메시지

### /messenger - DM 및 프레즌스

친구 간 1:1 메시지 및 온라인 상태를 관리합니다.

**이벤트**
- `messenger:ready` - 연결 준비 완료
- `dm:message` / `dm:send` - DM 메시지
- `dm:typing` - 타이핑 인디케이터
- `dm:read` / `dm:markRead` - 읽음 처리
- `friend:status` - 친구 상태 변경
- `friend:request` - 친구 요청 알림
- `presence:heartbeat` - 하트비트
- `presence:setStatus` - 상태 변경

---

## 데이터베이스 스키마

### 주요 모델

```prisma
// 사용자
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  isGuest      Boolean  @default(false)
  // relations...
}

// 세션
model Session {
  id              String        @id @default(uuid())
  code            String        @unique @db.VarChar(6)
  passwordHash    String?
  inviteToken     String?
  hostId          String
  status          SessionStatus @default(ACTIVE)
  maxGuests       Int           @default(100)
  // relations...
}

// 스트로크
model Stroke {
  id          String   @id @default(uuid())
  sessionId   String
  userId      String
  section     Int      @default(1024)
  owner       Int      @default(1)
  book        Int      @default(1)
  page        Int      @default(1)
  color       BigInt
  thickness   Float
  penType     Int
  points      Bytes    // 바이너리 포인트 데이터
  timestamp   BigInt
}

// 이용자별 페이퍼 (NCode PDF)
model UserPaper {
  id           String   @id @default(uuid())
  userId       String
  paperGroupId String   @unique
  sobKey       String   // "section.owner.book"
  title        String
  section      Int
  owner        Int
  book         Int
  pageStart    Int
  pageEnd      Int
  pageCount    Int
  nprojXml     String   @db.Text
  pdfPath      String
}

// 친구 관계
model Friendship {
  id            String  @id @default(uuid())
  userId        String
  friendId      String
  relationFlags Int     @default(1) // 비트마스크
  groupId       String?
}

// DM 메시지
model DirectMessage {
  id        String    @id @default(uuid())
  threadId  String
  senderId  String
  content   String
  readAt    DateTime?
  createdAt DateTime  @default(now())
}
```

---

## NCode PDF 생성

### 개요

PDF 문서에 NCode 패턴을 적용하여 스마트펜으로 인식 가능한 용지를 생성합니다.

### 파일명 컨벤션

```
{title}-ncoded-{S}_{O}_{B}_{P}-b{blueprint}-d{glyphScale}.pdf
```

**예시:**
- `document-ncoded-5_255_0_796-b1-d1.0.pdf` (청사진 모드, 기본 글리프)
- `report-ncoded-5_255_0_100-b0-d0.8.pdf` (일반 모드, 작은 글리프)

### 사용법 (클라이언트)

```typescript
import { generateNcodePdf, generateNcodePdfFilename } from './services/ncode-pdf-generator.service';

// PDF에 NCode 적용
const result = await generateNcodePdf({
  buffer: pdfArrayBuffer,
  paperGroupId: 'uuid',
  docName: 'document',
  printInBlue: true,       // 청사진 모드
  ncodeGlyphScale: 1.0,    // 글리프 크기
  pages: [
    { pageIndex: 0, section: 5, owner: 255, book: 0, page: 796 },
    // ...
  ],
  onProgress: (status, progress) => console.log(status, progress),
});

// 파일명 생성
const filename = generateNcodePdfFilename(
  'document',
  { section: 5, owner: 255, book: 0, pageStart: 796 },
  true,  // printInBlue
  1.0    // glyphScale
);
```

---

## 다국어 지원

### 지원 언어 (15개)

| 코드 | 언어 |
|------|------|
| ko | 한국어 |
| en-US | 영어 (미국) |
| en-GB | 영어 (영국) |
| ja | 일본어 |
| zh-CN | 중국어 (간체) |
| zh-TW | 중국어 (번체) |
| de | 독일어 |
| fr | 프랑스어 |
| es | 스페인어 |
| ar | 아랍어 |
| th | 태국어 |
| vi | 베트남어 |
| id | 인도네시아어 |
| ms | 말레이어 |
| fil | 필리핀어 |

### 번역 파일 위치

```
Client/Web/src/i18n/locales/
├── ko.json
├── en-US.json
├── ja.json
└── ...
```

---

## 배포

### Docker Compose (개발)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: penstreamdb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  server:
    build: ./Server
    ports:
      - "8190:8190"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/penstreamdb
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  client:
    build: ./Client/Web
    ports:
      - "5173:5173"
    depends_on:
      - server

volumes:
  postgres_data:
```

### Firebase Hosting (클라이언트)

```bash
# 빌드
cd Client/Web
npm run build

# Firebase 배포
firebase deploy --only hosting
```

자세한 배포 가이드는 [DEPLOY.md](./DEPLOY.md)를 참조하세요.

---

## 라이선스

이 프로젝트는 NeoLAB Convergence Inc.의 독점 소프트웨어입니다.

---

## 기여

버그 리포트나 기능 제안은 이슈를 통해 제출해 주세요.

---

## 문의

- 기술 지원: [support@neolab.net](mailto:support@neolab.net)
- 홈페이지: [https://www.neolab.net](https://www.neolab.net)
