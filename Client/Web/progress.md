# Progress Log: Messenger Feature

## Session: 2026-01-25

### Phase 1: Requirements & Discovery
**Status:** Complete

**Actions Taken:**
1. 사용자 요구사항 수집 및 분석
2. 프로젝트 구조 탐색 (Explore 에이전트 사용)
3. 현재 DB 스키마 분석 (`/Server/prisma/schema.prisma`)
4. 기존 채팅 구현 분석:
   - 서버: Socket.IO chat.ns.ts
   - 클라이언트: chat-service.ts, chat-store.ts
   - UI: MessengerModal.tsx
5. API 패턴 분석 (routes, services)

**Key Discoveries:**
- 친구 관련 테이블 없음 - 새로 설계 필요
- 현재 DM은 인메모리/클라이언트 측에만 저장
- 온라인 상태 추적 시스템 없음
- 기존 MessengerModal은 세션 참가자 기반으로만 동작

**Files Read:**
- `/Server/prisma/schema.prisma`
- `/Client/Web/src/components/layout/MessengerModal.tsx`
- `/Server/src/socket/namespaces/chat.ns.ts`
- `/Client/Web/src/services/chat-service.ts`
- `/Client/Web/src/stores/chat-store.ts`

---

### Phase 2: Database Schema Design
**Status:** Pending

**Plan:**
1. Friendship 모델 설계
2. FriendRequest 모델 설계
3. FriendGroup 모델 설계
4. DirectMessageThread 모델 설계
5. DirectMessage 모델 설계
6. User 모델에 관계 추가
7. Prisma migration 실행

---

### Phase 3: Backend API Implementation
**Status:** Pending

**Endpoints to Create:**

**Friend Routes (`/api/friends`):**
- `GET /` - 친구 목록 조회
- `POST /request` - 친구 요청 보내기
- `GET /requests` - 받은 친구 요청 목록
- `POST /requests/:id/accept` - 친구 요청 수락
- `POST /requests/:id/reject` - 친구 요청 거절
- `DELETE /:friendId` - 친구 삭제
- `PATCH /:friendId` - 관계 플래그/그룹 수정

**Friend Group Routes (`/api/friend-groups`):**
- `GET /` - 그룹 목록
- `POST /` - 그룹 생성
- `PATCH /:id` - 그룹 수정
- `DELETE /:id` - 그룹 삭제

**Message Routes (`/api/messages`):**
- `GET /threads` - 대화 스레드 목록
- `GET /threads/:threadId` - 특정 스레드 메시지 (페이지네이션)
- `POST /threads/:threadId/read` - 읽음 처리

**Socket Events:**
- `friend:status` - 친구 온라인 상태 변경
- `friend:request` - 새 친구 요청 알림
- `dm:message` - 새 DM 알림 (기존 확장)

---

### Phase 4: Frontend Implementation
**Status:** Pending

**Components to Create/Modify:**

1. **MessengerModal.tsx** 재설계:
   - 좌측 탭 (친구/메시지)
   - 리스트 패널 (친구 또는 대화 목록)
   - 대화창
   - "..." 메뉴 (참가자 목록, 친구 추가)

2. **New Components:**
   - `FriendTab.tsx` - 친구 탭 버튼
   - `MessageTab.tsx` - 메시지 탭 버튼
   - `FriendList.tsx` - 친구 목록 (상태 표시)
   - `MessageThreadList.tsx` - 대화 스레드 목록
   - `FriendRequestList.tsx` - 친구 요청 목록
   - `AddFriendModal.tsx` - 친구 추가 모달
   - `FriendGroupSelector.tsx` - 그룹 선택기

3. **New Stores:**
   - `friend-store.ts` - 친구 목록, 상태 관리
   - `messenger-store.ts` - 메신저 UI 상태

4. **New Services:**
   - `friend-service.ts` - 친구 API 호출
   - `presence-service.ts` - 온라인 상태 관리

---

### Test Results
(테스트 후 기록)

---

### Errors & Fixes
(에러 발생 시 기록)

---

## Next Steps
1. ~~Phase 1 완료~~ ✅
2. Phase 2: DB 스키마 설계 및 마이그레이션
3. Phase 3: 백엔드 API 구현
4. Phase 4: 프론트엔드 구현
5. Phase 5: 테스트
6. Phase 6: i18n 및 마무리
