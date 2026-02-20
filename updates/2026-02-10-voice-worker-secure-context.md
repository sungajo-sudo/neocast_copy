# 음성/스트로크 Web Worker 분리 및 Secure Context 대응

## 변경 일자
2026-02-10

## 변경 요약
음성 통화 품질 개선을 위해 Voice/Stroke Socket.IO를 Web Worker로 분리하고,
`window.confirm()` 전면 제거, Secure Context 미지원 환경(HTTP+IP) 대응을 수행했다.

## 핵심 변경 사항

### 1. Voice Socket → Web Worker 이전
- 새 파일: `Client/Web/src/workers/voice-socket.worker.ts`
- Socket.IO `/voice` 연결이 Worker 스레드에서 실행
- AudioWorklet ↔ Worker 간 MessageChannel 직접 통신 (메인 스레드 완전 우회)
- `voice-service.ts` 전면 리팩토링: `connect(socket)` → `connect(serverUrl, auth, query)`

### 2. Stroke Socket → Web Worker 이전
- 새 파일: `Client/Web/src/workers/stroke-socket.worker.ts`
- Socket.IO `/stroke` 연결 + 바이너리 파싱 + pako 압축 해제가 Worker에서 실행
- `stroke-service.ts` 전면 리팩토링: `connect(socket)` → `connect(serverUrl, auth, query)`
- `connection-store.ts`에서 `strokeSocket`/`voiceSocket` 제거 (controlSocket + chatSocket만 유지)

### 3. volatile emit + Jitter Buffer 확대
- `Server/src/socket/namespaces/voice.ns.ts`: `socket.to().volatile.emit()` 적용
- `playback-processor.js`: Jitter Buffer MIN 2→4 (80ms), MAX 5→12 (240ms)

### 4. window.confirm() 전면 제거 → AlertContext
- `AlertContext.tsx`에 `showConfirm()` 추가 (Promise<boolean> 기반 비동기 다이얼로그)
- 5개 파일에서 `window.confirm()` → `await showConfirm()` 교체
  - App.tsx, ToolbarActions.tsx, PenToolbar.tsx, SettingsModal.tsx, MyPapersPanel.tsx

### 5. Secure Context 대응 (HTTP + IP 접속)
- `.env`: `VITE_API_BASE_URL` 상대 경로(`/api`)로 변경 → Vite 프록시 경유
- `vite.config.ts`: `host: true` 추가 → 0.0.0.0 리슨 (IP 접속 가능)
- `voice-service.ts`: `navigator.mediaDevices` 가드 추가 (non-secure context 크래시 방지)
- 새 파일: `Client/Web/src/utils/clipboard.ts` — `navigator.clipboard` fallback 유틸
- 5개 파일에서 `navigator.clipboard.writeText()` → `copyToClipboard()` 교체

### 6. Screen Wake Lock
- `voice-service.ts`: 마이크 캡처 시 `navigator.wakeLock.request('screen')` 획득
- 모바일 화면 꺼짐 방지, `visibilitychange` 이벤트로 탭 복귀 시 재획득

### 7. Server Node.js 버전 고정
- `Server/package.json`: Volta `node: "22.22.0"` 핀 (Node v25 tsx 호환성 문제 방지)

### 8. 배포 시 Web 버전 자동 증가
- `deploy-scripts/oci/05-deploy.sh`: Web 빌드 전 `npm version patch --no-git-tag-version` 실행
- `Client/Web/index.html`: `<title>` 버전 플레이스홀더 `%APP_VERSION%` 적용
- `Client/Web/vite.config.ts`: `transformIndexHtml` 플러그인으로 빌드 시 자동 치환

## 변경된 파일

### 신규 파일
- `Client/Web/src/workers/voice-socket.worker.ts`: Voice Socket.IO Worker
- `Client/Web/src/workers/stroke-socket.worker.ts`: Stroke Socket.IO + 바이너리 파싱 Worker
- `Client/Web/src/utils/clipboard.ts`: Clipboard API fallback 유틸

### Client 수정
- `Client/Web/src/services/voice-service.ts`: Worker 기반 전면 리팩토링 + Wake Lock + mediaDevices 가드
- `Client/Web/src/services/stroke-service.ts`: Worker 기반 전면 리팩토링
- `Client/Web/src/stores/connection-store.ts`: strokeSocket/voiceSocket 제거, Worker 서비스 자동 연결
- `Client/Web/src/contexts/AlertContext.tsx`: showConfirm() 추가
- `Client/Web/public/audio-worklets/capture-processor.js`: workerPort 지원
- `Client/Web/public/audio-worklets/playback-processor.js`: workerPort 지원 + Jitter Buffer 확대
- `Client/Web/src/App.tsx`: confirm→showConfirm, clipboard→copyToClipboard, strokeSocket 참조 제거
- `Client/Web/src/components/toolbar/ToolbarActions.tsx`: confirm→showConfirm
- `Client/Web/src/components/toolbar/PenToolbar.tsx`: confirm→showConfirm
- `Client/Web/src/components/layout/SettingsModal.tsx`: confirm→showConfirm
- `Client/Web/src/components/panels/MyPapersPanel.tsx`: confirm→showConfirm
- `Client/Web/src/components/session/ConnectionPanel.tsx`: strokeSocket 참조 제거
- `Client/Web/src/components/session/SessionLobby.tsx`: strokeSocket 참조 제거
- `Client/Web/src/components/session/SessionInvite.tsx`: clipboard→copyToClipboard
- `Client/Web/src/components/session/SessionPanel.tsx`: clipboard→copyToClipboard
- `Client/Web/vite.config.ts`: host: true

### Server 수정
- `Server/src/socket/namespaces/voice.ns.ts`: volatile emit
- `Server/package.json`: Volta node pin

## 아키텍처 변경

```
[변경 전]
Main Thread: Control Socket + Chat Socket + Voice Socket + Stroke Socket + 바이너리 파싱 + AudioWorklet 통신

[변경 후]
Main Thread: Control Socket + Chat Socket + UI 업데이트
Voice Worker: Voice Socket.IO ↔ AudioWorklet (MessageChannel 직접 통신)
Stroke Worker: Stroke Socket.IO + 바이너리 파싱 + pako 압축 해제
```
