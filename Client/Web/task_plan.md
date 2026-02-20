# Task Plan: Messenger Feature Implementation

## Goal
NeoCAST에 친구 관리와 메시지 기능을 갖춘 메신저 시스템을 구현한다. 친구 목록, 상태 표시, 1:1 채팅, 메시지 히스토리 저장을 포함한다.

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [x] 사용자 요구사항 파악
- [x] 현재 코드베이스 탐색
- [x] DB 스키마 분석
- [x] 기존 채팅 구현 분석
- [x] findings.md에 문서화
- **Status:** complete

### Phase 2: Database Schema Design
- [ ] Friend 테이블 설계 (관계 플래그: 친구, 선생, 학생, 부모, 자녀)
- [ ] FriendGroup 테이블 설계
- [ ] DirectMessage 테이블 설계 (메시지 영속성)
- [ ] Prisma 마이그레이션 파일 생성
- **Status:** pending

### Phase 3: Backend API Implementation
- [ ] Friend API routes (CRUD, 친구 요청/수락/거절)
- [ ] FriendGroup API routes
- [ ] Message persistence API
- [ ] User presence/status 서비스
- [ ] Socket.IO 이벤트 확장
- **Status:** pending

### Phase 4: Frontend Implementation
- [ ] MessengerModal UI 재설계 (탭: 친구/메시지)
- [ ] FriendList 컴포넌트 (상태 표시: 온라인/오프라인/바쁨)
- [ ] MessageList 컴포넌트 (최근 대화)
- [ ] ChatView 컴포넌트 (대화창)
- [ ] 참가자 추가 "..." 버튼 메뉴
- [ ] Zustand store 확장 (friend-store, messenger-store)
- **Status:** pending

### Phase 5: Testing & Verification
- [ ] DB 마이그레이션 테스트
- [ ] API 엔드포인트 테스트
- [ ] UI 기능 테스트
- [ ] 실시간 메시징 테스트
- **Status:** pending

### Phase 6: i18n & Polish
- [ ] 번역 키 추가 (15개 언어)
- [ ] UI 다듬기
- [ ] 최종 검토
- **Status:** pending

## Key Questions
1. 친구 요청은 수락/거절 방식? 아니면 바로 추가? → **수락/거절 방식으로 구현**
2. 메시지는 얼마나 보관? → **무제한 (DB 영속성)**
3. 온라인 상태는 어떻게 추적? → **Socket.IO 연결 상태 + Redis**
4. 그룹 채팅 지원? → **현재는 1:1 채팅만, 추후 확장 가능**

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| PostgreSQL + Prisma 사용 | 기존 인프라 활용 |
| 관계 플래그를 비트 필드로 저장 | 다중 관계 지원 (부모이면서 선생 등) |
| Socket.IO로 실시간 상태 | 기존 채팅 인프라 활용 |
| DM을 DB에 영속 저장 | 재접속 시 히스토리 복원 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (아직 없음) | - | - |

## Notes
- 기존 MessengerModal이 있지만 세션 참가자 기반으로만 동작
- 친구 시스템은 세션과 독립적으로 작동해야 함
- 사용자 이미지에서 빨간색 = 탭 버튼, 녹색 = 리스트 패널, 파란색 = ... 메뉴 버튼
