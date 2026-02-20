# Task Plan: Voice/Stroke Worker + Alert Replacement

## Goal
음성 통화 품질 개선을 위한 4가지 작업:
1. volatile 플래그 + jitter buffer 확대 (즉시 효과)
2. Voice 소켓을 Web Worker로 이전 (AudioWorklet ↔ Worker MessageChannel)
3. Stroke 바이너리 처리를 Web Worker로 이전
4. window.confirm() 전부 비동기 AlertContext로 교체 + 방어적 조치

## Architecture

### Voice Worker Flow
```
[CaptureProcessor] ←MessageChannel→ [VoiceWorker] ←Socket.IO→ [Server]
[PlaybackProcessor] ←MessageChannel→ [VoiceWorker]
Main Thread: getUserMedia, UI updates, device enum only
```

### Stroke Worker Flow
```
Main Thread → postMessage(binary) → [StrokeWorker] → socket.emit()
[StrokeWorker] → socket.on('stroke') → parseMessage() → postMessage(parsed) → Main Thread → store update
```

## Phases

### Phase 1: Quick Wins (volatile + jitter buffer) `status: complete`
- [x] `Server/src/socket/namespaces/voice.ns.ts` - volatile emit for voice:data
- [x] `Client/Web/src/services/voice-service.ts` - volatile emit in worker
- [x] `Client/Web/public/audio-worklets/playback-processor.js` - MIN_BUFFER=4, MAX_BUFFER=12

### Phase 2: AlertContext Confirm + window.confirm Removal `status: complete`
- [x] `Client/Web/src/contexts/AlertContext.tsx` - Added showConfirm() returning Promise<boolean>
- [x] `Client/Web/src/App.tsx` - Replaced window.confirm
- [x] `Client/Web/src/components/toolbar/ToolbarActions.tsx` - Replaced
- [x] `Client/Web/src/components/toolbar/PenToolbar.tsx` - Replaced
- [x] `Client/Web/src/components/layout/SettingsModal.tsx` - Replaced
- [x] `Client/Web/src/components/panels/MyPapersPanel.tsx` - Replaced

### Phase 3: Voice Socket Worker `status: complete`
- [x] Create `Client/Web/src/workers/voice-socket.worker.ts`
- [x] Refactor `Client/Web/src/services/voice-service.ts` to use Worker
- [x] Update `Client/Web/src/stores/connection-store.ts` (removed voiceSocket from store)

### Phase 4: Stroke Socket Worker `status: complete`
- [x] Create `Client/Web/src/workers/stroke-socket.worker.ts`
- [x] Refactor `Client/Web/src/services/stroke-service.ts` to use Worker
- [x] Update `Client/Web/src/stores/connection-store.ts` (removed strokeSocket from store)
- [x] Fix remaining references: App.tsx, ConnectionPanel.tsx, SessionLobby.tsx

### Phase 5: Verification `status: complete`
- [x] TypeScript compile check - PASS (0 errors)
- [x] Vite production build - PASS (voice-socket.worker 43KB, stroke-socket.worker 95KB)

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
