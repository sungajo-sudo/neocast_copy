# Findings

## Architecture Insights
- Vite config: `worker: { format: 'es' }` - ES module workers supported
- Existing worker: `pdf-render.worker.ts` uses `self.onmessage` + `postMessage`
- Socket.IO client with `transports: ['websocket']` works in Web Workers
- connection-store creates 4 sockets: stroke, voice, control, chat
- Voice: 48kHz mono, 20ms frames (960 samples), Int16 PCM
- Stroke: Binary protocol with BinaryReader/Writer, pako for history compression
- AlertContext exists but only supports alert (OK), not confirm (OK/Cancel)

## window.confirm Locations (5 total)
1. App.tsx:680 - invite banner hide prompt
2. ToolbarActions.tsx:22 - canvas clear confirm
3. PenToolbar.tsx:78 - canvas clear confirm
4. SettingsModal.tsx:330 - NCode settings reset confirm
5. MyPapersPanel.tsx:98 - paper delete confirm

## Worker Constraints
- getUserMedia MUST be on main thread
- AudioContext creation MUST be on main thread
- Zustand store updates MUST be on main thread
- MessageChannel ports can be transferred to Workers and AudioWorklets
- socket.io-client with `transports: ['websocket']` works in Workers (no DOM needed)
