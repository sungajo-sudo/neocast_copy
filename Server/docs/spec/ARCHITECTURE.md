# PenStreamServer 기술 아키텍처 결정서

## 1. 기술 스택 선택

### 1.1 서버 런타임: Node.js 20 LTS (선택)

**선택 근거:**
| 기준 | Node.js | .NET 8 | Go | Java |
|------|---------|--------|-----|------|
| 클라우드 지원 (GCP/OCI) | ⭐⭐⭐ 최고 | ⭐⭐ 양호 | ⭐⭐⭐ 최고 | ⭐⭐⭐ 최고 |
| Docker 이미지 크기 | ⭐⭐⭐ ~50MB | ⭐⭐ ~85MB | ⭐⭐⭐ ~20MB | ⭐ ~200MB+ |
| WebSocket 생태계 | ⭐⭐⭐ Socket.io | ⭐⭐⭐ SignalR | ⭐⭐ gorilla | ⭐⭐ |
| 개발 생산성 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| 운영 인력 확보 | ⭐⭐⭐ 쉬움 | ⭐⭐ 보통 | ⭐⭐ 보통 | ⭐⭐⭐ 쉬움 |
| 서버리스 지원 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 바이너리 처리 | ⭐⭐ Buffer | ⭐⭐⭐ Span<T> | ⭐⭐⭐ | ⭐⭐ |

**결론:** 클라우드 배포 용이성, 생태계, 운영 편의성을 고려하여 Node.js 선택
- GCP Cloud Run, OCI Container Instances에서 즉시 배포 가능
- Socket.io로 강력한 WebSocket 지원 (자동 재연결, Room 관리)
- TypeScript로 타입 안정성 확보
- npm 생태계의 풍부한 라이브러리

---

### 1.2 프로젝트 구조

```
pen-stream-server/
├── src/
│   ├── index.ts                    # 앱 진입점
│   ├── app.ts                      # Fastify 앱 설정
│   │
│   ├── config/
│   │   ├── index.ts                # 환경 설정
│   │   └── database.ts             # DB 연결 설정
│   │
│   ├── routes/
│   │   ├── sessions.ts             # 세션 API
│   │   ├── archives.ts             # 아카이브 API
│   │   ├── auth.ts                 # 인증 API
│   │   └── admin.ts                # 관리자 API
│   │
│   ├── socket/
│   │   ├── index.ts                # Socket.io 설정
│   │   ├── handlers/
│   │   │   ├── stroke.handler.ts   # 필기 데이터 핸들러
│   │   │   ├── voice.handler.ts    # 음성 데이터 핸들러
│   │   │   └── control.handler.ts  # 제어 메시지 핸들러
│   │   └── middleware/
│   │       └── auth.middleware.ts  # 소켓 인증
│   │
│   ├── services/
│   │   ├── session.service.ts      # 세션 관리
│   │   ├── stroke.service.ts       # 스트로크 처리
│   │   ├── permission.service.ts   # 권한 관리
│   │   ├── archive.service.ts      # 아카이브 관리
│   │   └── voice.service.ts        # 음성 처리
│   │
│   ├── models/
│   │   ├── session.model.ts        # 세션 타입/스키마
│   │   ├── stroke.model.ts         # 스트로크 타입
│   │   ├── user.model.ts           # 사용자 타입
│   │   └── archive.model.ts        # 아카이브 타입
│   │
│   ├── protocol/
│   │   ├── binary-reader.ts        # 바이너리 파서
│   │   ├── binary-writer.ts        # 바이너리 직렬화
│   │   ├── message-types.ts        # 메시지 타입 상수
│   │   └── compression.ts          # 압축 유틸
│   │
│   ├── db/
│   │   ├── schema.prisma           # Prisma 스키마
│   │   └── migrations/             # DB 마이그레이션
│   │
│   └── utils/
│       ├── logger.ts               # 로깅 (Pino)
│       ├── errors.ts               # 커스텀 에러
│       └── helpers.ts              # 유틸 함수
│
├── admin-ui/                       # React 관리자 UI
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── hooks/
│   ├── package.json
│   └── vite.config.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.admin
│   └── docker-compose.yml
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

### 1.3 실시간 통신: Socket.io

**Socket.io 선택 이유:**
| 기능 | Socket.io | ws (Raw WebSocket) |
|------|-----------|-------------------|
| 자동 재연결 | ✅ 내장 | ❌ 직접 구현 |
| Room/Namespace | ✅ 내장 | ❌ 직접 구현 |
| 바이너리 지원 | ✅ ArrayBuffer, Buffer | ✅ |
| Fallback (Long Polling) | ✅ 자동 | ❌ |
| 클라이언트 SDK | ✅ 모든 플랫폼 | ❌ |
| Scale-out (Redis) | ✅ @socket.io/redis-adapter | ❌ 직접 구현 |

**Socket.io 네임스페이스 구조:**
```typescript
// 네임스페이스별 분리
io.of('/stroke')   // 필기 데이터 (Binary)
io.of('/voice')    // 음성 데이터 (Binary)
io.of('/control')  // 제어 메시지 (JSON)
```

---

### 1.4 음성 스트리밍: Socket.io (초기) → WebRTC (확장 시)

**비교:**
| 기능 | WebRTC | Socket.io |
|------|--------|-----------|
| 지연시간 | ⭐⭐⭐ 최소 (P2P) | ⭐⭐ 서버 경유 |
| 구현 복잡도 | ⭐ 복잡 | ⭐⭐⭐ 단순 |
| NAT 통과 | ICE/STUN/TURN 필요 | 서버 경유로 문제 없음 |
| 확장성 | SFU 서버 필요 | Redis로 쉽게 확장 |

**권장:** 초기에는 Socket.io로 구현, 사용자 증가 시 mediasoup 등 SFU 도입

---

### 1.5 데이터베이스

**용도별 선택:**

| 데이터 유형 | 저장소 | 근거 |
|------------|--------|------|
| 사용자/세션 메타 | PostgreSQL | 관계형, 트랜잭션, GCP/OCI 관리형 |
| 활성 세션 상태 | Redis | 빠른 읽기/쓰기, Pub/Sub |
| 필기 아카이브 | Cloud Storage + PostgreSQL | 바이너리는 GCS/OCI Object Storage |
| 통계/로그 | PostgreSQL (TimescaleDB 확장) | 시계열 쿼리 최적화 |

**ORM: Prisma**
```typescript
// schema.prisma
model Session {
  id              String    @id @default(uuid())
  code            String    @unique @db.VarChar(6)
  hostId          String
  status          SessionStatus @default(ACTIVE)
  createdAt       DateTime  @default(now())
  closedAt        DateTime?
  linkedArchiveId String?

  host            User      @relation(fields: [hostId], references: [id])
  participants    Participant[]
  archive         Archive?
}

model Stroke {
  id        String   @id @default(uuid())
  sessionId String
  userId    String
  pageId    Int
  color     Int      // ARGB
  thickness Float
  penType   Int
  points    Bytes    // 압축된 포인트 데이터
  createdAt DateTime @default(now())
}
```

---

## 2. 상세 아키텍처

### 2.1 레이어 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │  Fastify     │ │  Socket.io   │ │    React Admin UI       │ │
│  │  REST API    │ │   Server     │ │                          │ │
│  └──────┬───────┘ └──────┬───────┘ └───────────┬──────────────┘ │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
┌─────────┼────────────────┼─────────────────────┼────────────────┐
│         │         Application Layer            │                │
│  ┌──────┴───────────────┴─────────────────────┴──────────────┐  │
│  │                    Service Classes                        │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐  │  │
│  │  │  Session   │ │   Stroke   │ │   Voice    │ │Archive │  │  │
│  │  │  Service   │ │  Service   │ │  Service   │ │Service │  │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                │                     │
┌─────────┼────────────────┼─────────────────────┼────────────────┐
│         │           Domain Layer               │                │
│  ┌──────┴───────────────┴─────────────────────┴──────────────┐  │
│  │          TypeScript Types & Validation (Zod)              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                │                     │
┌─────────┼────────────────┼─────────────────────┼────────────────┐
│         │        Infrastructure Layer          │                │
│  ┌──────┴──────┐ ┌───────┴───────┐ ┌──────────┴──────────────┐  │
│  │   Prisma    │ │ Cloud Storage │ │     Redis (ioredis)     │  │
│  │ (PostgreSQL)│ │  (Archives)   │ │  (Cache + Pub/Sub)      │  │
│  └─────────────┘ └───────────────┘ └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 실시간 데이터 흐름

```
클라이언트 A (Host)                     서버                        클라이언트 B (Guest)
      │                                  │                               │
      │  ──── stroke:start ───────────▶  │                               │
      │       (Binary via Socket.io)     │                               │
      │                                  │  권한 확인                      │
      │                                  │  메모리에 버퍼링                │
      │                                  │                               │
      │  ──── stroke:point ───────────▶  │  ──── stroke:point ─────────▶  │
      │  ──── stroke:point ───────────▶  │  ──── stroke:point ─────────▶  │
      │       (20ms 간격)                │       (Room broadcast)         │
      │                                  │                               │
      │  ──── stroke:end ─────────────▶  │  ──── stroke:end ───────────▶  │
      │                                  │                               │
      │                                  │  완성된 스트로크 DB 저장        │
      │                                  │                               │
```

---

## 3. 핵심 컴포넌트 설계

### 3.1 Socket.io 설정

```typescript
// src/socket/index.ts
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

export function setupSocketIO(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  // Redis adapter for scale-out
  if (process.env.REDIS_URL) {
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  }

  // 네임스페이스별 설정
  const strokeNsp = io.of('/stroke');
  const voiceNsp = io.of('/voice');
  const controlNsp = io.of('/control');

  // 미들웨어 (인증)
  strokeNsp.use(authMiddleware);
  voiceNsp.use(authMiddleware);
  controlNsp.use(authMiddleware);

  // 핸들러 등록
  strokeNsp.on('connection', handleStrokeConnection);
  voiceNsp.on('connection', handleVoiceConnection);
  controlNsp.on('connection', handleControlConnection);

  return io;
}
```

### 3.2 SessionService

```typescript
// src/services/session.service.ts
import { prisma } from '../db';
import { redis } from '../config/redis';
import { nanoid } from 'nanoid';

interface ActiveSession {
  id: string;
  hostId: string;
  participants: Map<string, ParticipantInfo>;
  strokes: CompressedStroke[];
}

class SessionService {
  // 메모리 캐시 (단일 서버) 또는 Redis (멀티 서버)
  private activeSessions = new Map<string, ActiveSession>();

  async createSession(hostId: string, options: SessionOptions): Promise<Session> {
    const session = await prisma.session.create({
      data: {
        code: this.generateCode(), // "A1B2C3"
        hostId,
        status: 'ACTIVE',
        linkedArchiveId: options.linkedArchiveId,
      },
    });

    // 활성 세션 캐시에 추가
    const activeSession: ActiveSession = {
      id: session.id,
      hostId,
      participants: new Map(),
      strokes: [],
    };

    // 이전 아카이브 연결 시 히스토리 로드
    if (options.linkedArchiveId) {
      activeSession.strokes = await this.loadArchiveStrokes(options.linkedArchiveId);
    }

    this.activeSessions.set(session.id, activeSession);
    await redis.hset(`session:${session.id}`, 'status', 'ACTIVE');

    return session;
  }

  async joinSession(code: string, userId: string): Promise<JoinResult> {
    const session = await prisma.session.findUnique({
      where: { code },
    });

    if (!session) return { success: false, error: 'NOT_FOUND' };
    if (session.status !== 'ACTIVE') return { success: false, error: 'CLOSED' };

    const activeSession = this.activeSessions.get(session.id);
    if (!activeSession) return { success: false, error: 'NOT_ACTIVE' };

    // 참가자 추가
    activeSession.participants.set(userId, {
      id: userId,
      role: 'GUEST',
      joinedAt: new Date(),
    });

    // 히스토리 반환 (늦게 참가한 사용자용)
    return {
      success: true,
      session,
      history: activeSession.strokes,
    };
  }

  private generateCode(): string {
    return nanoid(6).toUpperCase();
  }
}

export const sessionService = new SessionService();
```

### 3.3 StrokeHandler

```typescript
// src/socket/handlers/stroke.handler.ts
import { Socket } from 'socket.io';
import { sessionService } from '../../services/session.service';
import { permissionService } from '../../services/permission.service';
import { BinaryReader, BinaryWriter } from '../../protocol';
import { MessageType } from '../../protocol/message-types';

export function handleStrokeConnection(socket: Socket) {
  const { sessionId, userId } = socket.data;

  // 세션 Room에 참가
  socket.join(`session:${sessionId}`);

  // 스트로크 시작
  socket.on('stroke:start', (data: Buffer) => {
    const reader = new BinaryReader(data);
    const strokeId = reader.readUUID();
    const pageId = reader.readUInt32();
    const color = reader.readUInt32();
    const thickness = reader.readFloat32();
    const penType = reader.readUInt8();

    // 현재 진행 중인 스트로크 저장
    sessionService.startStroke(sessionId, userId, {
      strokeId,
      pageId,
      color,
      thickness,
      penType,
    });

    // 권한이 있는 사용자들에게만 전송
    const receivers = permissionService.getReceiversFor(sessionId, userId);

    // 래퍼 패킷 생성 (송신자 정보 포함)
    const wrappedData = wrapWithSender(userId, data);

    receivers.forEach(receiverId => {
      socket.to(`user:${receiverId}`).emit('stroke:start', wrappedData);
    });
  });

  // 스트로크 포인트 (실시간)
  socket.on('stroke:point', (data: Buffer) => {
    const reader = new BinaryReader(data);
    const strokeId = reader.readUUID();
    const x = reader.readFloat32();
    const y = reader.readFloat32();
    const pressure = reader.readFloat32();
    const timestamp = reader.readInt64();

    // 버퍼에 포인트 추가
    sessionService.appendPoint(sessionId, userId, strokeId, { x, y, pressure, timestamp });

    // 즉시 브로드캐스트
    const receivers = permissionService.getReceiversFor(sessionId, userId);
    const wrappedData = wrapWithSender(userId, data);

    receivers.forEach(receiverId => {
      socket.to(`user:${receiverId}`).emit('stroke:point', wrappedData);
    });
  });

  // 스트로크 종료
  socket.on('stroke:end', async (data: Buffer) => {
    const reader = new BinaryReader(data);
    const strokeId = reader.readUUID();

    // 완성된 스트로크 압축 저장
    const completedStroke = await sessionService.completeStroke(sessionId, userId, strokeId);

    // 브로드캐스트
    const receivers = permissionService.getReceiversFor(sessionId, userId);
    const wrappedData = wrapWithSender(userId, data);

    receivers.forEach(receiverId => {
      socket.to(`user:${receiverId}`).emit('stroke:end', wrappedData);
    });
  });

  socket.on('disconnect', () => {
    sessionService.removeParticipant(sessionId, userId);
    socket.to(`session:${sessionId}`).emit('control:participant_left', { userId });
  });
}

function wrapWithSender(senderId: string, payload: Buffer): Buffer {
  const writer = new BinaryWriter();
  writer.writeUInt8(MessageType.WRAPPED);
  writer.writeUUID(senderId);
  writer.writeUInt32(payload.length);
  writer.writeBuffer(payload);
  return writer.toBuffer();
}
```

### 3.4 PermissionService

```typescript
// src/services/permission.service.ts
import { redis } from '../config/redis';

class PermissionService {
  // sessionId -> guestId -> Set<allowedSenderIds>
  private permissions = new Map<string, Map<string, Set<string>>>();

  async grantPermission(
    sessionId: string,
    hostId: string,
    guestId: string,
    targetUserId: string
  ): Promise<void> {
    // Host만 권한 부여 가능
    const session = await sessionService.getSession(sessionId);
    if (session.hostId !== hostId) {
      throw new Error('Only host can grant permissions');
    }

    let sessionPerms = this.permissions.get(sessionId);
    if (!sessionPerms) {
      sessionPerms = new Map();
      this.permissions.set(sessionId, sessionPerms);
    }

    let guestPerms = sessionPerms.get(guestId);
    if (!guestPerms) {
      guestPerms = new Set();
      sessionPerms.set(guestId, guestPerms);
    }

    guestPerms.add(targetUserId);

    // Redis에도 저장 (멀티 서버 환경)
    await redis.sadd(`perm:${sessionId}:${guestId}`, targetUserId);

    // Control 채널로 알림
    this.notifyPermissionChanged(sessionId, guestId);
  }

  getReceiversFor(sessionId: string, senderId: string): string[] {
    const receivers: string[] = [];
    const session = sessionService.getActiveSession(sessionId);

    // Host는 모든 필기를 받음
    receivers.push(session.hostId);

    // 권한이 있는 Guest들
    const sessionPerms = this.permissions.get(sessionId);
    if (sessionPerms) {
      for (const [guestId, allowedSenders] of sessionPerms) {
        if (allowedSenders.has(senderId)) {
          receivers.push(guestId);
        }
      }
    }

    return receivers;
  }
}

export const permissionService = new PermissionService();
```

### 3.5 ArchiveService

```typescript
// src/services/archive.service.ts
import { prisma } from '../db';
import { Storage } from '@google-cloud/storage'; // 또는 OCI SDK
import { compress, decompress } from '../protocol/compression';

const storage = new Storage();
const bucket = storage.bucket(process.env.ARCHIVE_BUCKET!);

class ArchiveService {
  async archiveSession(sessionId: string): Promise<Archive> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { participants: true },
    });

    const activeSession = sessionService.getActiveSession(sessionId);

    // 아카이브 생성
    const archive = await prisma.archive.create({
      data: {
        originalSessionId: sessionId,
        hostId: session!.hostId,
        closedAt: new Date(),
        totalStrokes: activeSession.strokes.length,
        linkedPreviousArchiveId: session!.linkedArchiveId,
      },
    });

    // 스트로크 데이터를 Cloud Storage에 저장
    const strokesData = Buffer.from(JSON.stringify(activeSession.strokes));
    const compressedData = await compress(strokesData);

    await bucket.file(`archives/${archive.id}/strokes.bin.gz`).save(compressedData);

    // 썸네일 생성 (선택적)
    // await this.generateThumbnail(archive.id, activeSession.strokes);

    // 세션 상태 업데이트
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'ARCHIVED', closedAt: new Date() },
    });

    return archive;
  }

  async loadArchiveStrokes(archiveId: string): Promise<CompressedStroke[]> {
    const [compressedData] = await bucket
      .file(`archives/${archiveId}/strokes.bin.gz`)
      .download();

    const strokesData = await decompress(compressedData);
    return JSON.parse(strokesData.toString());
  }

  async restoreSession(archiveId: string, hostId: string): Promise<Session> {
    // 아카이브를 기반으로 새 세션 생성
    return sessionService.createSession(hostId, {
      linkedArchiveId: archiveId,
    });
  }
}

export const archiveService = new ArchiveService();
```

### 3.6 Binary Protocol

```typescript
// src/protocol/binary-reader.ts
export class BinaryReader {
  private offset = 0;

  constructor(private buffer: Buffer) {}

  readUInt8(): number {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt32(): number {
    const value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readFloat32(): number {
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  readInt64(): bigint {
    const value = this.buffer.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readUUID(): string {
    const bytes = this.buffer.subarray(this.offset, this.offset + 16);
    this.offset += 16;
    return uuidFromBytes(bytes);
  }
}

// src/protocol/binary-writer.ts
export class BinaryWriter {
  private chunks: Buffer[] = [];

  writeUInt8(value: number): this {
    const buf = Buffer.alloc(1);
    buf.writeUInt8(value);
    this.chunks.push(buf);
    return this;
  }

  writeUInt32(value: number): this {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(value);
    this.chunks.push(buf);
    return this;
  }

  writeFloat32(value: number): this {
    const buf = Buffer.alloc(4);
    buf.writeFloatLE(value);
    this.chunks.push(buf);
    return this;
  }

  writeBuffer(data: Buffer): this {
    this.chunks.push(data);
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

// src/protocol/message-types.ts
export const MessageType = {
  STROKE_START: 0x01,
  STROKE_POINT: 0x02,
  STROKE_END: 0x03,
  STROKE_CANCEL: 0x04,
  PAGE_CHANGE: 0x10,
  CLEAR_ALL: 0x20,
  UNDO: 0x21,
  REDO: 0x22,
  WRAPPED: 0xF0,
} as const;
```

---

## 4. 배포 아키텍처

### 4.1 단일 서버 (소규모, ~100 동시 세션)

```
┌────────────────────────────────────────────┐
│              Single Server                 │
│  ┌──────────────────────────────────────┐  │
│  │         Docker Compose               │  │
│  │  ┌─────────────┐ ┌────────────────┐  │  │
│  │  │ Node.js     │ │   PostgreSQL   │  │  │
│  │  │ Server      │ │                │  │  │
│  │  │ (Port 3000) │ │ (Port 5432)    │  │  │
│  │  └─────────────┘ └────────────────┘  │  │
│  │  ┌─────────────┐ ┌────────────────┐  │  │
│  │  │   Nginx     │ │     Redis      │  │  │
│  │  │ (Port 443)  │ │  (Port 6379)   │  │  │
│  │  └─────────────┘ └────────────────┘  │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://penstream:${DB_PASSWORD}@db:5432/penstream
      - REDIS_URL=redis://redis:6379
      - ARCHIVE_BUCKET=penstream-archives
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=penstream
      - POSTGRES_USER=penstream
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - server

volumes:
  pgdata:
  redisdata:
```

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 4.2 GCP Cloud Run 배포

```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/pen-stream-server', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/pen-stream-server']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'pen-stream-server'
      - '--image=gcr.io/$PROJECT_ID/pen-stream-server'
      - '--region=asia-northeast3'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--set-env-vars=DATABASE_URL=$$DATABASE_URL'
      - '--set-env-vars=REDIS_URL=$$REDIS_URL'
      - '--session-affinity'  # WebSocket용 세션 고정
```

### 4.3 확장 구성 (대규모, ~1000+ 동시 세션)

```
┌─────────────────────────────────────────────────────────────────┐
│                   Cloud Load Balancer                           │
│               (GCP LB / OCI Load Balancer)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Instance 1  │   │  Instance 2  │   │  Instance 3  │
│  (Node.js)   │   │  (Node.js)   │   │  (Node.js)   │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
       ┌─────────────┐         ┌─────────────┐
       │   Redis     │         │ Cloud SQL   │
       │ (Memorystore│         │ (PostgreSQL)│
       │  / OCI)     │         │             │
       └─────────────┘         └─────────────┘

       ┌─────────────────────────────────────────┐
       │    Cloud Storage (GCS / OCI Object)     │
       │            (Archives)                   │
       └─────────────────────────────────────────┘
```

**Socket.io Redis Adapter로 Scale-out:**
```typescript
// 여러 서버 간 소켓 이벤트 동기화
import { createAdapter } from '@socket.io/redis-adapter';

const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

---

## 5. 성능 고려사항

### 5.1 Buffer Pool (메모리 최적화)
```typescript
// 버퍼 재사용으로 GC 부담 감소
import { Pool } from 'generic-pool';

const bufferPool = Pool.createPool({
  create: () => Buffer.alloc(1024),
  destroy: (buf) => { /* no-op */ },
}, { max: 1000 });

async function processStroke(data: Buffer) {
  const buffer = await bufferPool.acquire();
  try {
    data.copy(buffer);
    // 처리...
  } finally {
    bufferPool.release(buffer);
  }
}
```

### 5.2 배치 전송
```typescript
// 포인트들을 모아서 배치 전송
class PointBatcher {
  private queues = new Map<string, StrokePoint[]>();
  private timer: NodeJS.Timeout;

  constructor(private io: Server) {
    // ~60fps로 플러시
    this.timer = setInterval(() => this.flush(), 16);
  }

  add(sessionId: string, point: StrokePoint) {
    let queue = this.queues.get(sessionId);
    if (!queue) {
      queue = [];
      this.queues.set(sessionId, queue);
    }
    queue.push(point);
  }

  private flush() {
    for (const [sessionId, points] of this.queues) {
      if (points.length > 0) {
        this.io.to(`session:${sessionId}`).emit('stroke:points', points);
        points.length = 0;
      }
    }
  }
}
```

### 5.3 압축
```typescript
// src/protocol/compression.ts
import { brotliCompress, brotliDecompress } from 'zlib';
import { promisify } from 'util';

const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

export async function compress(data: Buffer): Promise<Buffer> {
  return brotliCompressAsync(data);
}

export async function decompress(data: Buffer): Promise<Buffer> {
  return brotliDecompressAsync(data);
}

// Delta encoding for stroke points
export function deltaEncode(points: Point[]): number[] {
  const result: number[] = [];
  let prevX = 0, prevY = 0;

  for (const p of points) {
    result.push(p.x - prevX, p.y - prevY, p.pressure);
    prevX = p.x;
    prevY = p.y;
  }

  return result;
}
```

---

## 6. 모니터링 및 로깅

### 6.1 Pino 로깅
```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});

// 사용 예
logger.info({ sessionId, hostId }, 'Session created');
logger.error({ err, sessionId }, 'Failed to archive session');
```

### 6.2 메트릭스 (Prometheus)
```typescript
// src/utils/metrics.ts
import { Registry, Counter, Gauge, Histogram } from 'prom-client';

export const register = new Registry();

export const sessionsCreated = new Counter({
  name: 'penstream_sessions_created_total',
  help: 'Total sessions created',
  registers: [register],
});

export const activeSessions = new Gauge({
  name: 'penstream_active_sessions',
  help: 'Currently active sessions',
  registers: [register],
});

export const strokeLatency = new Histogram({
  name: 'penstream_stroke_latency_seconds',
  help: 'Stroke delivery latency',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

// Fastify 라우트
app.get('/metrics', async (req, reply) => {
  reply.header('Content-Type', register.contentType);
  return register.metrics();
});
```

---

## 7. 개발 로드맵

### Phase 1: MVP
- [ ] 기본 세션 생성/참가 (Fastify + Prisma)
- [ ] 필기 스트리밍 (Socket.io + Binary)
- [ ] Host/Guest 역할
- [ ] 기본 권한 관리
- [ ] PostgreSQL 저장

### Phase 2: 핵심 기능
- [ ] 아카이브 시스템 (Cloud Storage)
- [ ] 세션 연결 (Linked Sessions)
- [ ] 늦은 참가자 동기화
- [ ] 관리자 대시보드 (React)

### Phase 3: 음성 + 확장
- [ ] 음성 스트리밍 (Socket.io)
- [ ] 관리자 통계
- [ ] GCP/OCI 배포
- [ ] Redis Scale-out

### Phase 4: 최적화
- [ ] 성능 테스트 (k6, Artillery)
- [ ] 버퍼 풀링 최적화
- [ ] 모니터링 구축 (Prometheus + Grafana)

---

*문서 버전: 1.1*
*최종 수정: 2026-01-09*
