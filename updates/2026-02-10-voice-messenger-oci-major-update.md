# 음성 통화, 메신저 파일 첨부, OCI 배포 — 주요 기능 업데이트

## 변경 일자
2026-02-10

## 변경 요약
실시간 음성 통화(PCM over Socket.IO) 기능 전체 구현, DM 파일 첨부 기능, OCI(Oracle Cloud) 배포 체계 신설, 스트로크 전송 개선 등 대규모 기능 추가 및 인프라 변경.

---

## 1. 실시간 음성 통화 기능 (Voice Chat) — 신규

가장 핵심적인 신규 기능. 세션 참가자 간 실시간 음성 통화를 지원한다.

### 아키텍처
- **PCM over Socket.IO** 방식 (WebRTC 미사용, 서버 릴레이)
- 48 kHz mono, 20 ms 프레임(960 samples), Int16 PCM
- AudioWorklet 기반: `capture-processor.js`(녹음), `playback-processor.js`(재생)

### 클라이언트 측 (신규 파일)
- `voice-service.ts` (547줄): AudioContext/AudioWorklet 관리, 캡처·재생 파이프라인, 디바이스 열거, 마이크/스피커 테스트 기능
- `voice-store.ts` (114줄): Zustand 스토어 — `isMuted`, `canTransmit`, `inputDevice`, `outputDevice`, `error` 등 상태 관리
- `AudioSettingsTab.tsx` (202줄): 설정 모달 내 오디오 탭 — 입출력 디바이스 선택, 마이크/스피커 테스트 UI
- `capture-processor.js`, `playback-processor.js`: AudioWorklet 프로세서 (public 디렉토리)

### 서버 측
- `voice.ns.ts`: 스텁(stub) → 실제 구현으로 전환
  - 접속 시 `canTransmit` 권한 정보 전송
  - 게스트의 `voice:data`/`voice:start`/`voice:end`/`voice:mute`/`voice:unmute` 이벤트에 권한 체크 적용
  - 호스트는 항상 전송 가능, 게스트는 `session.allowGuestVoice` 설정에 따름

### UI 통합
- **MicrophoneButton**: 단순 토글 → Zoom 스타일 split button으로 재설계
  - 메인 영역 클릭: 음소거/음소거 해제 토글
  - 드롭다운 화살표(▾) 클릭: 오디오 설정 열기
  - 컴팩트 모드 대응 (우하단 미니 화살표)
  - `canTransmit` false 시 비활성화 + 토스트 안내
- **ControlBar**: 버튼 수 11 → 12개, Mic 버튼을 Stylus 옆 필수 버튼으로 배치
- **SettingsModal**: `audio` 탭 추가, `openSettingsTab()` 메서드로 외부에서 특정 탭 직접 열기 지원
- **panel-store**: `settingsInitialTab`, `openSettingsTab(tab)` 액션 추가
- **connection-store**: `voiceService.connect(voiceSocket)` / `disconnect()` 자동 연결

### i18n
- 16개 언어 모두에 `voice.*` 키 11개 추가 (micPermissionDenied, transmitNotAllowed, testMicrophone 등)

---

## 2. DM 파일 첨부 기능 (Messenger Attachments)

### 개요
메신저 DM에 파일(이미지, PDF, 문서 등)을 첨부하여 전송할 수 있게 됨.

### DB 스키마
- `DirectMessage` 모델에 `metadata` (Text, nullable) 컬럼 추가
- 첨부파일 정보를 JSON 형태로 `metadata` 필드에 저장

### 서버 변경
- `message.service.ts`: `sendMessage()`에 `metadata` 파라미터 추가, 응답에 metadata 포함
- `messenger.ns.ts`: `dm:send`, `dm:sendToFriend` 이벤트에 metadata 필드 지원, content 비어있어도 metadata 있으면 전송 허용

### 클라이언트 변경
- `messenger-store.ts`: `DmAttachment` 인터페이스 신규, `Message` 타입에 `attachments?` 필드 추가, 스레드 목록에서 첨부파일 미리보기 (`📎 파일명`)
- `messenger-service.ts`:
  - `parseAttachments()` / `enrichMessage()`: 서버 metadata JSON → attachments 배열 변환
  - `sendMessage()` / `sendMessageToFriend()`: attachments 매개변수 추가, metadata JSON 직렬화
  - 메시지 수신(`dm:message`, `dm:sent`) 및 조회 시 자동 파싱
- `ChatView.tsx`:
  - 파일 첨부 버튼 (클립 아이콘) 추가
  - `fileUploadService` 연동: 파일 선택 → 업로드 → 첨부파일 메시지 전송
  - 업로드 진행률 바, 에러 표시 UI
  - 이미지 첨부: 인라인 썸네일 렌더링 (최대 192x192)
  - 일반 파일: 아이콘 + 파일명 + 크기 + 다운로드 링크 카드

---

## 3. OCI (Oracle Cloud Infrastructure) 배포 체계 — 신규

### 배포 스크립트 (`deploy-scripts/oci/`)
GCP 배포 스크립트와 별도로, Oracle Cloud Always Free 티어(ARM Ampere A1.Flex) 타겟의 완전한 배포 파이프라인:
- `config.sh`: 공통 설정 (리전, OCID, SSH 포트 등)
- `00-teardown.sh`: 기존 리소스 전체 정리 (compartment 기반 탐색)
- `01-resize-tamai.sh`: 인스턴스 리사이즈
- `02-oci-setup.sh`: VCN, 서브넷, 보안 리스트, 인스턴스 생성
- `03-server-init.sh`: OS 초기화 (Docker, firewall, SSH 포트 변경)
- `04-ssl-setup.sh`: Certbot SSL 인증서 (pip venv 방식)
- `05-deploy.sh`: Docker Compose 배포
- `06-migrate-db-from-gcp.sh`: GCP → OCI DB 마이그레이션
- `nginx-neocast.conf`, `docker-compose.prod.yml`, `.env.production.example`

### OCI Object Storage Provider (신규)
- `oci-storage.provider.ts` (291줄): `IStorageProvider` 구현
  - `SimpleAuthenticationDetailsProvider` 사용
  - Pre-Authenticated Request (PAR) 방식 signed URL 생성
  - 파일 업로드/다운로드/삭제/목록 조회
- `storage/index.ts`: `StorageType`에 `'oci'` 추가, 팩토리에 `OciStorageProvider` 분기
- `Server/package.json`: `oci-common`, `oci-objectstorage` 의존성 추가
- `Server/.env.example`: OCI 관련 환경변수 가이드 추가

### GCP 스크립트 정리
- `scripts/` → `deploy-scripts/gcp/`로 이동 (rename)
- `deploy-scripts/gcp/deploy.sh`, `deploy_db.sh`: 경로 수정

---

## 4. 스트로크 전송 최적화 변경

- `stroke-service.ts`: 포인트 배치 전송(batch) 방식 제거 → **점 하나씩 즉시 전송**으로 변경
  - `BATCH_SIZE`, `BATCH_INTERVAL_MS`, `pendingPoints`, `batchTimers`, `flushPoints()` 모두 제거
  - 목적: 리모트 측에서 부드러운 실시간 렌더링 달성
  - 코드 82줄 감소 (단순화)

---

## 5. 기타 개선사항

### 서버
- **API 404 핸들러** (`Server/src/index.ts`): 존재하지 않는 API 경로 접근 시, 브라우저(Accept: text/html)면 `/`로 리다이렉트, API 클라이언트면 404 JSON 응답
- **게스트 사용자 생성** (`session.service.ts`): `prisma.user.create` → `prisma.user.upsert`로 변경 (동일 이메일 중복 방지)
- **Control 네임스페이스** (`control.ns.ts`):
  - sessionId 없는 연결 시 즉시 disconnect 대신 경고 로그 후 대기 (재연결 안정성)
  - 새 소켓 접속 시 기존 참가자 목록을 `PARTICIPANT_JOIN` 이벤트로 일괄 전송
- **Admin UI**: v1.0.6 → v1.0.7, `VITE_BASE_PATH` 빌드 인자 지원, BrowserRouter basename 설정

### 클라이언트
- **소켓 URL 결정 로직 통일** (`connection-store.ts`, `messenger-service.ts`, `nc-paperhub-client.service.ts`):
  - 상대 경로(`/api`) → `window.location.origin` 사용 (nginx 프록시 환경 지원)
  - 빈 값 → `http://localhost:8190` 폴백
- **소켓 연결 옵션**: `forceNew: true` 추가 (재연결 시 새 소켓 강제 생성)
- `.gitignore`: OCI API 키 디렉토리 제외 추가

---

## 변경된 파일 목록 (48개)

### 신규 파일
- `Client/Web/src/services/voice-service.ts` — 음성 서비스 (547줄)
- `Client/Web/src/stores/voice-store.ts` — 음성 스토어 (114줄)
- `Client/Web/src/components/settings/AudioSettingsTab.tsx` — 오디오 설정 탭 (202줄)
- `Client/Web/public/audio-worklets/capture-processor.js` — 마이크 캡처 AudioWorklet
- `Client/Web/public/audio-worklets/playback-processor.js` — 재생 AudioWorklet
- `Server/src/services/storage/oci-storage.provider.ts` — OCI 스토리지 프로바이더 (291줄)
- `deploy-scripts/oci/` — OCI 배포 스크립트 일체 (15개 파일)

### 수정 파일 (주요)
- `Client/Web/src/components/control-bar/MicrophoneButton.tsx` — split button 재설계
- `Client/Web/src/components/layout/ControlBar.tsx` — Mic 버튼 통합
- `Client/Web/src/components/layout/SettingsModal.tsx` — audio 탭 추가
- `Client/Web/src/components/messenger/ChatView.tsx` — 파일 첨부 UI
- `Client/Web/src/services/messenger-service.ts` — 첨부파일 지원
- `Client/Web/src/services/stroke-service.ts` — 배치 전송 제거
- `Client/Web/src/stores/connection-store.ts` — voice 서비스 연결
- `Client/Web/src/stores/messenger-store.ts` — DmAttachment 타입
- `Client/Web/src/stores/panel-store.ts` — openSettingsTab
- `Server/src/socket/namespaces/voice.ns.ts` — 음성 권한 체크
- `Server/src/socket/namespaces/messenger.ns.ts` — metadata 지원
- `Server/src/socket/namespaces/control.ns.ts` — 참가자 목록 전송
- `Server/src/services/message.service.ts` — metadata 필드
- `Server/src/services/session.service.ts` — upsert 변경
- `Server/src/services/storage/index.ts` — OCI 프로바이더 등록
- `Server/prisma/schema.prisma` — metadata 컬럼
- `Server/src/index.ts` — 404 핸들러
- `Client/Web/src/i18n/locales/*.json` (16개) — voice 키 추가
