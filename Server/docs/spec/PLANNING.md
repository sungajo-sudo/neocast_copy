# PenStreamServer 기획서

## 1. 개요

### 1.1 프로젝트 목적

실시간 펜 필기 데이터와 음성을 여러 사용자 간에 중계하고 보관하는 서버 시스템

### 1.2 핵심 기능

- **실시간 필기 스트리밍**: 점 단위 실시간 전송으로 부드러운 필기 표현
- **음성 채팅**: 실시간 음성 중계 (보관 없음)
- **세션 관리**: Host/Guest 역할 기반 권한 시스템
- **아카이브**: 세션 종료 후 필기 데이터 보관 및 재사용

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                      PenStreamServer                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  WebSocket  │  │    REST     │  │      Admin Web UI       │  │
│  │   Server    │  │     API     │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                │
│  ┌──────┴────────────────┴─────────────────────┴─────────────┐  │
│  │                    Core Services                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ Session  │ │  Stroke  │ │  Voice   │ │   Archive    │  │  │
│  │  │ Manager  │ │ Streamer │ │ Streamer │ │   Manager    │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                      Storage Layer                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │   Database   │  │  File Store  │  │  Memory Cache   │  │  │
│  │  │  (SQLite/    │  │  (Archives)  │  │   (Active       │  │  │
│  │  │   Postgres)  │  │              │  │    Sessions)    │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 통신 프로토콜

- **필기 데이터**: WebSocket (Binary)
- **음성 데이터**: WebSocket (Binary) 또는 WebRTC
- **관리 API**: REST API (JSON)
- **관리자 UI**: HTTP/HTTPS

---

## 3. 세션 관리

### 3.1 Zoom 스타일 세션 플로우

#### 호스트 플로우 (세션 생성)
```
1. 로그인 → 토큰 발급
2. "새 세션 만들기" 선택
3. 세션 비밀번호 설정 (선택)
4. 세션 생성 → 서버 자동 연결
5. "초대하기" 버튼 → 초대 링크 클립보드 복사
6. 링크를 이메일/메신저로 공유
7. 게스트 입장 대기 → 협업 시작
```

#### 게스트 플로우 (세션 참여)
```
1. 초대 링크 클릭 (예: https://app.penstream.io/join/ABC123)
2. 로그인/회원가입 (미인증 시)
3. 세션 비밀번호 입력 (설정된 경우)
4. 자동 세션 참여 → 협업 시작
```

#### 초대 링크 형식
```
https://{host}/join/{sessionCode}
https://{host}/join/{sessionCode}?password={encodedPassword}
```

### 3.2 세션 구조

```
Session
├── SessionId: UUID
├── SessionCode: string (6자리 접속 코드)
├── Password: string? (암호화된 세션 비밀번호, 선택)
├── CreatedAt: DateTime
├── Status: Active | Paused | Closed
├── Host: User
├── Guests: User[]
├── LinkedArchiveId: UUID? (이전 세션 연결 시)
└── Settings
    ├── MaxGuests: int
    ├── AllowGuestVoice: bool
    └── AutoArchive: bool
```

### 3.3 역할 및 권한

| 권한                      | Host | Guest                  |
| ------------------------- | ---- | ---------------------- |
| 필기 전송 (Send)          | ✅   | ✅                     |
| 필기 수신 (Receive)       | ✅   | ❌ (Host 허가 시 가능) |
| 다른 사용자에게 필기 공유 | ✅   | ❌                     |
| 음성 송신                 | ✅   | ✅ (설정에 따라)       |
| 음성 수신                 | ✅   | ✅                     |
| 세션 종료                 | ✅   | ❌                     |
| 세션 일시정지             | ✅   | ❌                     |
| 아카이브 접근             | ✅   | ❌                     |

### 3.4 필기 공유 메커니즘

Host가 특정 Guest에게 필기를 보여주는 방식:

```
┌────────────────────────────────────────────────────────────────┐
│                         Session                                │
│                                                                │
│   Host ─────────────────────┐                                  │
│     │                       │                                  │
│     │ (Host의 필기)          │                                  │
│     ▼                       │                                  │
│   Server                    │                                  │
│     │                       │                                  │
│     │ Permission Table:     │                                  │
│     │ ┌─────────────────────┴───────────────────┐              │
│     │ │ Guest A: [Host 필기 수신 ✅]              │              │
│     │ │ Guest B: [Host 필기 수신 ❌]              │              │
│     │ │ Guest C: [Host 필기 ✅, Guest A 필기 ✅]  │              │
│     │ └─────────────────────────────────────────┘              │
│     │                                                          │
│     ├──▶ Guest A (Host 필기 수신)                               │
│     ├──▶ Guest B (수신 없음)                                    │
│     └──▶ Guest C (Host + Guest A 필기 수신)                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. 데이터 구조

> **상세 프로토콜 명세는 [PROTOCOL.md](./PROTOCOL.md)를 참조하세요.**

### 4.1 필기 데이터 (Binary Protocol)

- **전송 방식**: WebSocket (Socket.io) Binary
- **바이트 순서**: Little Endian
- **좌표 단위**: 밀리미터 (mm)

#### 주요 메시지 타입 요약

| Type ID | Name          | Size     | Description      |
| ------- | ------------- | -------- | ---------------- |
| 0x01    | STROKE_START  | 39 bytes | 새 스트로크 시작 |
| 0x02    | STROKE_POINT  | 35 bytes | 점 데이터        |
| 0x03    | STROKE_END    | 17 bytes | 스트로크 종료    |
| 0x04    | STROKE_CANCEL | 17 bytes | 스트로크 취소    |
| 0x05    | STROKE_POINT_BATCH | 가변 | 점 배치 전송     |
| 0x10    | PAGE_CHANGE   | 5 bytes  | 페이지 변경      |
| 0xF0    | WRAPPED       | 21+N bytes | 서버 래핑 메시지 |

#### 스트로크 데이터 포맷 요약

- **STROKE_START**: StrokeId, PageId, Color(ARGB), Thickness, PenType, Flags, **Timestamp**
- **STROKE_POINT**: StrokeId, X, Y, **Pressure(uint16, 0~65535)**, Timestamp
- **STROKE_END/CANCEL**: StrokeId만 포함

> 📋 전체 패킷 구조, 바이트 오프셋, 구현 예시는 [PROTOCOL.md](./PROTOCOL.md) 참조

### 4.2 음성 데이터

- **Codec**: Opus
- **Sample Rate**: 48kHz
- **Channels**: Mono
- **Frame Size**: 20ms
- **네임스페이스**: `/voice` (별도 WebSocket 채널)

> 📋 음성 패킷 상세는 [PROTOCOL.md - Section 9](./PROTOCOL.md#9-음성-메시지) 참조

### 4.3 제어 메시지

- **네임스페이스**: `/control`
- **형식**: JSON
- **주요 이벤트**: 세션 상태, 참가자 입퇴장, 권한 변경, 히스토리 동기화

> 📋 JSON 메시지 스키마는 [PROTOCOL.md - Section 10](./PROTOCOL.md#10-control-채널-json) 참조

---

## 5. API 설계

### 5.1 REST API

#### 세션 관리

```
POST   /api/sessions                    # 새 세션 생성 (Host)
GET    /api/sessions/{id}               # 세션 정보 조회
DELETE /api/sessions/{id}               # 세션 종료
POST   /api/sessions/join               # 세션 참가 (Guest) - code로 참가
POST   /api/sessions/{id}/leave         # 세션 나가기
PATCH  /api/sessions/{id}/settings      # 세션 설정 변경
```

##### 세션 생성 (POST /api/sessions)
```json
// Request (Authorization: Bearer {accessToken})
{
  "password": "optional-password",    // 세션 비밀번호 (선택)
  "maxGuests": 100,                   // optional
  "allowGuestVoice": true,            // optional
  "autoArchive": true,                // optional
  "linkedArchiveId": "uuid"           // optional, 이전 세션 연결
}
// Response (201)
{
  "success": true,
  "session": {
    "id": "uuid",
    "code": "ABC123",
    "hasPassword": true,
    "status": "ACTIVE",
    "hostId": "uuid",
    "createdAt": "2026-01-09T00:00:00Z"
  }
}
```

##### 세션 참가 (POST /api/sessions/join)
```json
// Request (Authorization: Bearer {accessToken})
{
  "code": "ABC123",                   // 6자리 세션 코드
  "password": "optional-password"     // 비밀번호 (설정된 경우 필수)
}
// Response (200)
{
  "success": true,
  "session": { ... },
  "participant": {
    "userId": "uuid",
    "role": "GUEST",
    "joinedAt": "2026-01-09T00:00:00Z"
  }
}
```

##### 세션 정보 조회 (GET /api/sessions/code/{code})
```json
// Response (200) - 비밀번호 필요 여부 확인용
{
  "success": true,
  "session": {
    "id": "uuid",
    "code": "ABC123",
    "hasPassword": true,
    "status": "ACTIVE",
    "participantCount": 5
  }
}

# 권한 관리
POST   /api/sessions/{id}/permissions   # 필기 공유 권한 설정
GET    /api/sessions/{id}/permissions   # 권한 목록 조회
DELETE /api/sessions/{id}/permissions/{guestId}/{targetId}  # 권한 제거

# 아카이브
GET    /api/archives                    # 아카이브 목록
GET    /api/archives/{id}               # 아카이브 상세
POST   /api/archives/{id}/restore       # 아카이브로 새 세션 생성
DELETE /api/archives/{id}               # 아카이브 삭제
```

#### 사용자 관리

```
POST   /api/auth/register               # 사용자 등록 (회원가입)
POST   /api/auth/login                  # 로그인
POST   /api/auth/token/refresh          # 토큰 갱신
GET    /api/auth/me                     # 내 정보 조회
PATCH  /api/auth/me                     # 내 정보 수정 (이름, 비밀번호)
DELETE /api/auth/me                     # 회원 탈퇴
```

#### 사용자 관리 API 상세

##### 회원가입 (POST /api/auth/register)
```json
// Request
{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동"
}
// Response (201)
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "홍길동",
    "createdAt": "2026-01-09T00:00:00Z"
  }
}
```

##### 로그인 (POST /api/auth/login)
```json
// Request
{
  "email": "user@example.com",
  "password": "password123"
}
// Response (200)
{
  "success": true,
  "user": { ... },
  "tokens": {
    "accessToken": "jwt...",
    "refreshToken": "jwt..."
  }
}
```

##### 내 정보 수정 (PATCH /api/auth/me)
```json
// Request (Authorization: Bearer {accessToken})
{
  "name": "새이름",           // optional
  "currentPassword": "...",   // 비밀번호 변경 시 필수
  "newPassword": "..."        // optional
}
// Response (200)
{
  "success": true,
  "user": { ... }
}
```

##### 회원 탈퇴 (DELETE /api/auth/me)
```json
// Request (Authorization: Bearer {accessToken})
{
  "password": "현재비밀번호"
}
// Response (200)
{
  "success": true,
  "message": "Account deleted successfully"
}
```

### 5.2 WebSocket 엔드포인트

```
ws://{host}/ws/stroke/{sessionId}       # 필기 데이터 스트림
ws://{host}/ws/voice/{sessionId}        # 음성 데이터 스트림
ws://{host}/ws/control/{sessionId}      # 제어 메시지 (JSON)
```

#### Control 채널 메시지 (JSON)

```json
// 세션 상태 변경 알림
{
  "type": "SESSION_STATUS",
  "status": "active|paused|closed",
  "timestamp": 1234567890
}

// 참가자 입장/퇴장
{
  "type": "PARTICIPANT_JOIN|PARTICIPANT_LEAVE",
  "userId": "uuid",
  "userName": "string",
  "role": "host|guest"
}

// 권한 변경 알림
{
  "type": "PERMISSION_CHANGED",
  "guestId": "uuid",
  "canReceiveFrom": ["uuid1", "uuid2"]
}

// 늦은 참가자 히스토리 전송 시작/완료
{
  "type": "HISTORY_SYNC_START|HISTORY_SYNC_END",
  "totalStrokes": 150,
  "fromArchive": true|false
}
```

---

## 6. 아카이브 시스템

### 6.1 아카이브 구조

```
Archive
├── ArchiveId: UUID
├── OriginalSessionId: UUID
├── CreatedAt: DateTime
├── ClosedAt: DateTime
├── HostId: UUID
├── Participants: ParticipantInfo[]
│   ├── UserId
│   ├── UserName
│   ├── Role
│   ├── JoinedAt
│   └── LeftAt
├── Pages: Page[]
│   ├── PageId
│   └── Strokes: Stroke[]
├── TotalStrokes: int
├── TotalDuration: TimeSpan
└── LinkedSessions: UUID[] (연결된 이전/이후 세션들)
```

### 6.2 아카이브 파일 형식

```
/archives
  /{archiveId}
    /metadata.json          # 세션 메타데이터
    /participants.json      # 참가자 정보
    /pages
      /page_{pageId}.bin    # 페이지별 필기 데이터 (바이너리)
    /thumbnail.png          # 미리보기 이미지
```

### 6.3 세션 연결 (Linked Sessions)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Archive A   │────▶│  Archive B   │────▶│  Session C   │
│  (Closed)    │     │  (Closed)    │     │  (Active)    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
                 Linked Session Chain
```

- Host가 Archive B를 기반으로 Session C를 열면:
  - Archive A, B의 모든 필기가 로드됨
  - 새로 참가하는 Guest에게 전체 히스토리 전송
  - Session C 종료 시 새 Archive가 생성되며 체인에 연결

---

## 7. 관리자 페이지

### 7.1 대시보드

```
┌─────────────────────────────────────────────────────────────────┐
│  PenStreamServer Admin                              [Logout]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐  │
│  │ Active      │  │ Total       │  │ Today's     │  │ Peak   │  │
│  │ Sessions    │  │ Users       │  │ Sessions    │  │ Users  │  │
│  │    24       │  │   1,234     │  │    156      │  │   89   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘  │
│                                                                 │
│  [Active Sessions]  [Statistics]  [Archives]  [Settings]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 주요 메뉴

#### 7.2.1 활성 세션 (Active Sessions)

| Session ID | Code   | Host  | Guests | Duration | Actions      |
| ---------- | ------ | ----- | ------ | -------- | ------------ |
| abc-123... | A1B2C3 | User1 | 5      | 1h 23m   | [View] [End] |
| def-456... | D4E5F6 | User2 | 12     | 45m      | [View] [End] |

- 실시간 세션 목록
- 세션 강제 종료
- 세션 상세 모니터링 (참가자, 트래픽 등)

#### 7.2.2 통계 (Statistics)

- **일별/주별/월별 세션 수**
- **평균 세션 시간**
- **평균 참가자 수**
- **피크 타임 분석**
- **데이터 트래픽 현황**

```
세션 생성 추이 (최근 30일)
     │
 200 │        ╭─╮
 150 │    ╭───╯ ╰──╮
 100 │ ───╯        ╰───╮
  50 │                 ╰────
     └─────────────────────────
       1    10    20    30 (일)
```

#### 7.2.3 아카이브 관리 (Archives)

- 아카이브 목록 조회
- 아카이브 다운로드
- 아카이브 삭제
- 스토리지 사용량

#### 7.2.4 설정 (Settings)

- 서버 설정
- 최대 동시 세션 수
- 세션당 최대 참가자 수
- 아카이브 보관 기간
- 로그 레벨

---

## 8. 보안

### 8.1 인증/인가

- JWT 기반 인증
- 세션 참가 코드 (6자리)
- Role 기반 권한 관리 (Host/Guest/Admin)

### 8.2 데이터 보안

- TLS/SSL 암호화 (WSS, HTTPS)
- 아카이브 암호화 (AES-256)
- 개인정보 최소 수집

### 8.3 접근 제어

- Rate Limiting
- IP 기반 차단
- CORS 설정

---

## 9. 기술 스택 (권장)

### 9.1 서버

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.x
- **Framework**: Fastify (REST API)
- **WebSocket**: Socket.io (실시간 통신)
- **Database**: PostgreSQL (Cloud SQL / OCI Database)
- **Cache**: Redis (Memorystore / OCI Cache)
- **ORM**: Prisma 또는 Drizzle
- **Validation**: Zod

### 9.2 관리자 UI

- **Framework**: React 18 + Vite
- **UI Library**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts 또는 Chart.js
- **State**: TanStack Query

### 9.3 배포

- **Container**: Docker (Alpine 기반, ~50MB)
- **Cloud**: GCP Cloud Run / OCI Container Instances
- **Orchestration**: Docker Compose / Kubernetes
- **Reverse Proxy**: Nginx / Cloud Load Balancer
- **Storage**: GCS / OCI Object Storage (아카이브용)

---

## 10. 클라이언트 연동

### 10.1 PenStreamerAvalonia (송신측)

기존 기능에서 확장 필요:

- 점 단위 실시간 전송
- 스트로크 시작/종료 이벤트
- 색상/굵기 정보 포함
- 음성 송신 기능

### 10.2 PenReceiverAvalonia (수신측)

기존 기능에서 확장 필요:

- 점 단위 실시간 수신 및 렌더링
- 여러 사용자 필기 구분 표시
- 히스토리 동기화 처리
- 음성 수신 기능

---

## 11. 향후 확장 고려사항

### 11.1 Phase 2 기능

- [ ] 화이트보드 공유 (이미지/PDF 배경)
- [ ] 포인터/레이저 기능
- [ ] 녹화/재생 기능
- [ ] 화면 공유 연동

### 11.2 Phase 3 기능

- [ ] 다중 서버 클러스터링
- [ ] 지역별 서버 (Geo-distributed)
- [ ] AI 필기 인식 연동
- [ ] 협업 도구 연동 (Slack, Teams 등)

---

## 12. 부록

### 12.1 용어 정의

| 용어           | 정의                                 |
| -------------- | ------------------------------------ |
| Session        | 하나의 협업 공간, 여러 사용자가 참여 |
| Host           | 세션 생성자, 전체 권한 보유          |
| Guest          | 세션 참가자, 제한된 권한             |
| Stroke         | 하나의 연속된 필기 획                |
| Archive        | 종료된 세션의 저장된 데이터          |
| Linked Session | 이전 아카이브와 연결된 세션          |

### 12.2 상태 다이어그램

```
세션 상태:
                    ┌──────────┐
                    │  Created │
                    └────┬─────┘
                         │ Host 접속
                         ▼
                    ┌──────────┐
         ┌──────────│  Active  │◀─────────┐
         │          └────┬─────┘          │
         │ Pause         │ Close     Resume
         ▼               │               │
    ┌──────────┐         │          ┌────┴─────┐
    │  Paused  │─────────┼─────────▶│          │
    └──────────┘         │          └──────────┘
                         ▼
                    ┌──────────┐
                    │  Closed  │
                    └────┬─────┘
                         │ Auto Archive
                         ▼
                    ┌──────────┐
                    │ Archived │
                    └──────────┘
```

---

*문서 버전: 1.0*
*최종 수정: 2026-01-09*
