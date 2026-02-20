# NeoCAST 주요 기능 대규모 업데이트

## 변경 일자
2026-01-25

## 변경 요약
NCode PDF 생성, NC-PaperHub, 채팅/메신저, 친구 관리, GCS 스토리지 지원 등 대규모 기능 추가

## 변경 통계
- 수정된 파일: 49개
- 새로 추가된 파일/디렉토리: 50개 이상
- 총 변경 라인: +5,198 / -482

---

## 0. 기획/디자인 요청사항 (신규 추가)

### A. 메인 컨셉 추가 (위치: "원격 학습과 회의를 위한 완벽한 솔루션" 섹션 상단)
*기존 수채화 풍의 따뜻한 감성을 유지하며 다음 내용을 포함해주세요.*

**[헤드카피 제안]**
"종이 위에 펼쳐지는 나만의 스마트 교실, Ncode로 시작하세요"

**[주요 포함 내용]**
1.  **Ncode PDF 생성 (특허기술)**
    *   "NeoLAB의 독보적인 특허 기술로 일반 PDF를 스마트한 Ncode 교재로 변환합니다. 선생님만의 노하우가 담긴 자료를 학생들에게 손쉽게 배포하세요."
2.  **실시간 필기 전송**
    *   "수업이나 회의 중 종이에 쓴 필기가 실시간으로 상대방에게 전송됩니다. 아날로그의 감성은 그대로, 디지털의 편리함은 더했습니다."
3.  **AI 분석 시스템**
    *   **과정 중심 평가**: "단순히 정답만 체크하는 것이 아니라, 문제 풀이 과정 전체를 AI가 분석하여 학습자의 사고 과정을 파악합니다."
    *   **멀티모달 분석**: "필기 데이터와 음성을 결합한 정밀한 분석으로, 학습자의 이해도와 심리 상태까지 입체적으로 진단합니다."

---

### B. 타겟 오디언스 및 활용 예시 (위치: "철저한 세션 보안과 개인정보 보호" 섹션 하단)
*시장 조사를 바탕으로 도출된 추천 사용자 그룹입니다.*

**1. 스마트 교육 전문가 (EdTech Educators)**
*   **상황**: 학생 한 명 한 명의 풀이 과정을 꼼꼼히 지켜보고 싶지만 시간이 부족한 선생님.
*   **활용**: AI가 분석한 '풀이 과정 리포트'를 통해 맞춤형 피드백 제공.

**2. 원격 과외/학습 코치**
*   **상황**: 화상 회의만으로는 학생이 실제로 문제를 어떻게 풀고 있는지 확인하기 어려운 튜터.
*   **활용**: 실시간으로 전송되는 손글씨를 보며 바로 옆에 있는 것처럼 첨삭 지도.

**3. 비즈니스 컨설턴트 및 전문직**
*   **상황**: 복잡한 다이어그램이나 아이디어를 즉석에서 그리며 설명해야 하는 전문가.
*   **활용**: 종이 노트에 자연스럽게 그리며 설명하고, 그 과정과 음성을 함께 기록하여 고객에게 프로페셔널한 결과물로 전달 (보안 필수).

**4. 아동 발달 상담 센터**
*   **상황**: 내담자의 그림 그리는 순서, 필압, 머무는 시간 등을 정밀하게 관찰해야 하는 상담사.
*   **활용**: 멀티모달 분석을 통해 그림 검사(HTP 등)의 과정을 데이터로 정량화하여 상담 보조 자료로 활용.

---

---

## 1. NCode PDF 생성 시스템 (신규)

### 새 파일
- `Client/Web/src/services/ncode-pdf-generator.service.ts`: PDF에 NCode 패턴 적용 (wasm-pdf-core 사용)
- `Client/Web/src/services/nproj-generator.service.ts`: NPROJ XML 생성 (WebCaster v2.31 호환)
- `Client/Web/src/services/nc-paperhub-client.service.ts`: NcPaperHub API 클라이언트
- `Client/Web/src/services/local-paperhub.service.ts`: IndexedDB 기반 로컬 Paper 저장소

### 주요 기능
- SOBP (Section.Owner.Book.Page) 할당 및 관리
- PDF에 NCode 패턴 오버레이 적용
- 청사진(파란색) 변환 옵션
- 클라이언트에서 직접 NPROJ XML 생성
- IndexedDB를 통한 오프라인 Paper 캐시

### 파일명 컨벤션
```
{title}-ncoded-{S}_{O}_{B}_{P}-b{blueprint}-d{glyphScale}.pdf
예: document-ncoded-5_255_0_796-b1-d1.0.pdf
```

---

## 2. NC-PaperHub 서버 시스템 (신규)

### 새 파일
- `Server/src/routes/nc-paperhub.ts`: NcPaperHub API 라우트
- `Server/src/services/nc-paperhub.service.ts`: NcPaperHub 비즈니스 로직

### DB 스키마 추가
- `NcodeAllocation`: 이용자별 NCode 할당 상태 추적
- `UserPaper`: 이용자별 페이퍼 정보 (PDF + NPROJ)

### API 엔드포인트
- `POST /api/nc-paperhub/allocate`: SOBP 할당
- `POST /api/nc-paperhub/attach`: PDF + NPROJ 업로드
- `GET /api/nc-paperhub/papers`: 사용자 페이퍼 목록
- `GET /api/nc-paperhub/paper/:id`: 페이퍼 상세 조회
- `GET /api/nc-paperhub/paper/:id/compound`: NP2 파일 다운로드
- `POST /api/nc-paperhub/lookup`: SOBP로 페이퍼 조회

---

## 3. 채팅/메신저 시스템 (신규)

### Client 새 파일
- `Client/Web/src/services/chat-service.ts`: 세션 내 실시간 채팅
- `Client/Web/src/services/messenger-service.ts`: DM 및 프레즌스 관리
- `Client/Web/src/stores/chat-store.ts`: 채팅 상태 관리
- `Client/Web/src/stores/messenger-store.ts`: 메신저 상태
- `Client/Web/src/components/messenger/`: 메신저 UI 컴포넌트

### Server 새 파일
- `Server/src/routes/session-chat.ts`: 세션 채팅 API
- `Server/src/routes/messages.ts`: DM 메시지 API
- `Server/src/services/session-chat.service.ts`: 세션 채팅 서비스
- `Server/src/services/message.service.ts`: 메시지 서비스
- `Server/src/socket/namespaces/chat.ns.ts`: 채팅 소켓 네임스페이스
- `Server/src/socket/namespaces/messenger.ns.ts`: 메신저 소켓 네임스페이스

### DB 스키마 추가
- `SessionChatMessage`: 세션 채팅 메시지 영구 저장
- `DirectMessageThread`: DM 대화 스레드
- `DirectMessage`: DM 메시지

### 주요 기능
- 세션 참가자 간 실시간 그룹 채팅 (Socket.IO)
- 친구 간 1:1 다이렉트 메시지
- 타이핑 인디케이터
- 프레즌스 (온라인/자리비움/바쁨)
- 메시지 읽음 확인

---

## 4. 친구 초대 시스템 (신규)

### Client 새 파일
- `Client/Web/src/services/friend-service.ts`: 친구 관리 REST API
- `Client/Web/src/stores/friend-store.ts`: 친구 상태

### Server 새 파일
- `Server/src/routes/friends.ts`: 친구 관리 API
- `Server/src/routes/friend-groups.ts`: 친구 그룹 API
- `Server/src/services/friend.service.ts`: 친구 서비스
- `Server/src/services/presence.service.ts`: 프레즌스 서비스

### DB 스키마 추가
- `Friendship`: 친구 관계 (관계 플래그 비트마스크)
- `FriendRequest`: 친구 요청
- `FriendGroup`: 친구 그룹

### 관계 플래그 (비트마스크)
- FRIEND=1, TEACHER=2, STUDENT=4, PARENT=8, CHILD=16

### 주요 기능
- 이메일로 사용자 검색
- 친구 요청 전송/수락/거절
- 친구 그룹 관리
- 양방향 자동 수락

---

## 5. GCS (Google Cloud Storage) 지원 (신규)

### 새 파일
- `Server/src/services/storage/index.ts`: Storage Provider Factory
- `Server/src/services/storage/storage-provider.interface.ts`: 인터페이스
- `Server/src/services/storage/local-storage.provider.ts`: 로컬 저장소
- `Server/src/services/storage/gcs-storage.provider.ts`: GCS 저장소
- `Server/src/services/file-storage.service.ts`: 파일 업로드 서비스

### 환경변수 설정
```bash
STORAGE_TYPE=local|gcs
LOCAL_STORAGE_PATH=./storage
GCS_PROJECT_ID=neocast-local
GCS_BUCKET_PREFIX=neocast-dev
GCS_EMULATOR_HOST=http://localhost:4443
```

### 버킷 구조
- `files`: 채팅 파일 첨부
- `papers`: NCode PDF/NPROJ 저장

---

## 6. UI 컴포넌트 (신규)

### 새 컴포넌트
- `Client/Web/src/components/messenger/ChatView.tsx`: 채팅 뷰
- `Client/Web/src/components/messenger/FriendList.tsx`: 친구 목록
- `Client/Web/src/components/messenger/MessageThreadList.tsx`: 메시지 스레드
- `Client/Web/src/components/messenger/MessengerTabs.tsx`: 메신저 탭
- `Client/Web/src/components/panels/ChatPanel.tsx`: 채팅 패널
- `Client/Web/src/components/panels/MyPapersPanel.tsx`: 내 문서 패널
- `Client/Web/src/components/dialogs/PrintSettingsDialog.tsx`: 인쇄 설정

---

## 7. i18n 다국어 지원 확장

### 지원 언어 (15개)
ar, de, en-GB, en-US, es, fil, fr, id, ja, ko, ms, th, vi, zh-CN, zh-TW

### 추가된 번역 키
- 채팅: chat.*, messenger.*
- 친구: friends.*, friendRequest.*
- NCode/Paper: paper.*, ncode.*
- 인쇄: print.*

---

## 8. 기타 변경사항

### 수정된 주요 파일
- `Client/Web/src/App.tsx`: 레이아웃 리팩토링, 새 기능 통합
- `Client/Web/src/components/canvas/CanvasContainer.tsx`: NCode 지원 확장
- `Client/Web/src/components/session/ParticipantList.tsx`: 참가자 목록 개선
- `Client/Web/src/stores/session-store.ts`: 세션 상태 확장
- `Client/Web/src/stores/stroke-store.ts`: 스트로크 저장 개선
- `Client/Web/src/utils/nprojUtils.ts`: NPROJ 유틸리티 확장
- `Client/Web/vite.config.ts`: nl-pdf-wrapper alias 설정
- `Server/prisma/schema.prisma`: 새 모델 추가 (182줄 추가)
- `Server/.env.example`: GCS 환경변수 추가

### 새 Stores
- `panel-store.ts`: 패널 상태 관리
- `print-settings-store.ts`: 인쇄 설정 상태
- `settings-store.ts`: 앱 설정 상태

---

## 아키텍처 다이어그램

```
Client (React + Vite)
├── Services
│   ├── ncode-pdf-generator (wasm-pdf-core)
│   ├── nproj-generator (v2.31 XML)
│   ├── nc-paperhub-client (REST)
│   ├── local-paperhub (IndexedDB)
│   ├── chat-service (Socket.IO)
│   ├── messenger-service (Socket.IO + REST)
│   └── friend-service (REST)
├── Stores (Zustand)
│   ├── chat-store, messenger-store, friend-store
│   └── panel-store, settings-store
└── Components
    ├── messenger/, panels/, dialogs/
    └── canvas/ (NCode 지원 확장)

Server (Fastify + Prisma)
├── Routes
│   ├── nc-paperhub, session-chat
│   ├── messages, friends, friend-groups
│   └── file-upload
├── Services
│   ├── nc-paperhub, session-chat, friend, message
│   ├── presence, file-storage
│   └── storage/ (Local/GCS Provider)
└── Socket Namespaces
    ├── /chat (세션 채팅)
    └── /messenger (DM + 프레즌스)
```
