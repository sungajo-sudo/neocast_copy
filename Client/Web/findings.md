# Findings & Decisions: Messenger Feature

## Requirements
<!-- 사용자 요구사항 -->
- 메신저 모달에 탭 추가: (친구) / (메시지)
- 친구 리스트: 친구 상태 표시 (온라인, 오프라인, 바쁨 등)
- 메시지 리스트: 최근 대화 목록 (yyyy-mm-dd hhmmss 형식 타임스탬프)
- 친구 클릭 시 대화창 열림 + 메시지 탭으로 전환
- "..." 버튼: 참가자 목록 + 친구 추가 기능
- 친구 관계 유형: 친구, 선생, 학생, 부모, 자녀 (복수 선택 가능)
- 친구 그룹 기능

## Research Findings

### 현재 데이터베이스 스키마 (Prisma)
- **User 모델**: id, email, passwordHash, name, isGuest, createdAt, updatedAt
- **Session 모델**: code, passwordHash, hostId, status, maxGuests 등
- **Participant 모델**: sessionId, userId, role (HOST/GUEST)
- **친구 관련 테이블 없음** - 새로 만들어야 함

### 현재 채팅 구현
- **서버**: Socket.IO `/chat` 네임스페이스
- **메시지 저장**: 인메모리 (Map), 세션당 최대 100개
- **DM**: 클라이언트 측에만 저장 (Zustand), DB 영속성 없음
- **상태 추적**: 타이핑 인디케이터만 있음, 온라인/오프라인 없음

### 기존 MessengerModal 구조
- 위치: `/src/components/layout/MessengerModal.tsx`
- 현재: 세션 참가자 기반 DM만 지원
- 레이아웃: 좌측 참가자 목록 + 우측 대화창
- 상태: useChatStore의 dmConversations 사용

### API 패턴
- Fastify 플러그인 패턴
- Zod 스키마 검증
- Bearer 토큰 인증
- 커스텀 에러 클래스 (ValidationError, AuthenticationError 등)

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 관계 플래그를 비트마스크로 저장 | `FRIEND=1, TEACHER=2, STUDENT=4, PARENT=8, CHILD=16` - 복수 관계 지원 |
| FriendRequest 테이블 분리 | 요청/수락/거절 플로우 관리 |
| DirectMessageThread 테이블 | 1:1 대화 스레드 관리 (추후 그룹 채팅 확장 가능) |
| Redis로 온라인 상태 추적 | Socket.IO 연결과 연동, 수평 확장 지원 |
| 메시지 페이지네이션 | 초기 로드 시 최근 50개, 스크롤 시 추가 로드 |

## New Database Tables Design

### Friendship 테이블
```prisma
model Friendship {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  friendId      String   @map("friend_id")
  relationFlags Int      @default(1) @map("relation_flags") // 비트마스크
  groupId       String?  @map("group_id")
  createdAt     DateTime @default(now()) @map("created_at")

  user   User         @relation("UserFriends", fields: [userId], references: [id])
  friend User         @relation("FriendOf", fields: [friendId], references: [id])
  group  FriendGroup? @relation(fields: [groupId], references: [id])

  @@unique([userId, friendId])
  @@map("friendships")
}
```

### FriendRequest 테이블
```prisma
model FriendRequest {
  id          String              @id @default(uuid())
  fromUserId  String              @map("from_user_id")
  toUserId    String              @map("to_user_id")
  status      FriendRequestStatus @default(PENDING)
  message     String?
  createdAt   DateTime            @default(now()) @map("created_at")
  respondedAt DateTime?           @map("responded_at")

  fromUser User @relation("SentRequests", fields: [fromUserId], references: [id])
  toUser   User @relation("ReceivedRequests", fields: [toUserId], references: [id])

  @@unique([fromUserId, toUserId])
  @@map("friend_requests")
}

enum FriendRequestStatus {
  PENDING
  ACCEPTED
  REJECTED
}
```

### FriendGroup 테이블
```prisma
model FriendGroup {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  name      String
  color     String?
  createdAt DateTime @default(now()) @map("created_at")

  user        User         @relation(fields: [userId], references: [id])
  friendships Friendship[]

  @@unique([userId, name])
  @@map("friend_groups")
}
```

### DirectMessageThread 테이블
```prisma
model DirectMessageThread {
  id           String   @id @default(uuid())
  participant1 String   @map("participant1_id")
  participant2 String   @map("participant2_id")
  lastMessageAt DateTime? @map("last_message_at")
  createdAt    DateTime @default(now()) @map("created_at")

  user1    User            @relation("ThreadUser1", fields: [participant1], references: [id])
  user2    User            @relation("ThreadUser2", fields: [participant2], references: [id])
  messages DirectMessage[]

  @@unique([participant1, participant2])
  @@map("dm_threads")
}
```

### DirectMessage 테이블
```prisma
model DirectMessage {
  id        String   @id @default(uuid())
  threadId  String   @map("thread_id")
  senderId  String   @map("sender_id")
  content   String
  readAt    DateTime? @map("read_at")
  createdAt DateTime @default(now()) @map("created_at")

  thread DirectMessageThread @relation(fields: [threadId], references: [id])
  sender User                @relation(fields: [senderId], references: [id])

  @@index([threadId, createdAt])
  @@map("direct_messages")
}
```

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| (아직 없음) | - |

## Resources
- Prisma 스키마: `/Server/prisma/schema.prisma`
- 채팅 소켓: `/Server/src/socket/namespaces/chat.ns.ts`
- 채팅 서비스: `/Client/Web/src/services/chat-service.ts`
- 채팅 스토어: `/Client/Web/src/stores/chat-store.ts`
- 메신저 모달: `/Client/Web/src/components/layout/MessengerModal.tsx`

## Visual/Browser Findings
- 사용자 제공 이미지 분석:
  - 빨간색 영역: 좌측 탭 버튼 (친구/메시지)
  - 녹색 영역: 리스트 패널 (친구 목록 또는 메시지 목록)
  - 파란색 원: 우측 상단 "..." 메뉴 버튼
  - 현재 UI: "참가자를 선택하세요 / 대화를 시작하려면" 메시지

---
*Update this file after every 2 view/browser/search operations*
