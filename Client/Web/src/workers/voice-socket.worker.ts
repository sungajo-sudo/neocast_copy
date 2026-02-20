/**
 * Voice Socket Worker
 *
 * Socket.IO /voice 네임스페이스 연결을 Web Worker에서 실행하여
 * 메인 스레드 부하와 무관하게 음성 데이터를 안정적으로 송수신한다.
 *
 * AudioWorklet ↔ Worker 간 MessageChannel로 직접 통신하여
 * 메인 스레드를 완전히 우회한다.
 *
 * 메인 스레드 역할: getUserMedia, AudioContext 생성, UI 상태 업데이트
 * Worker 역할: Socket.IO 연결, PCM 프레임 릴레이
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Capture: AudioWorklet에서 직접 수신할 MessagePort
let capturePort: MessagePort | null = null;

// Playback: senderId별 AudioWorklet에 직접 전달할 MessagePort
const playbackPorts = new Map<string, MessagePort>();

/**
 * Worker 메시지 핸들러
 */
self.onmessage = (event: MessageEvent) => {
  const msg = event.data;

  switch (msg.type) {
    case 'connect':
      handleConnect(msg.url, msg.auth, msg.query);
      break;

    case 'disconnect':
      handleDisconnect();
      break;

    case 'set-capture-port':
      handleSetCapturePort(msg.port);
      break;

    case 'set-playback-port':
      handleSetPlaybackPort(msg.senderId, msg.port);
      break;

    case 'remove-playback-port':
      playbackPorts.delete(msg.senderId);
      break;

    case 'emit':
      // 일반 이벤트 전달 (voice:start, voice:end, voice:mute, voice:unmute)
      if (socket?.connected) {
        socket.emit(msg.event, msg.data);
      }
      break;
  }
};

/**
 * Socket.IO 연결
 */
function handleConnect(url: string, auth: Record<string, unknown>, query: Record<string, unknown>): void {
  if (socket) {
    socket.disconnect();
  }

  socket = io(`${url}/voice`, {
    auth,
    query,
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    postMsg({ type: 'connected' });
  });

  socket.on('disconnect', (reason: string) => {
    postMsg({ type: 'disconnected', reason });
  });

  socket.on('connect_error', (error: Error) => {
    postMsg({ type: 'connect_error', message: error.message });
  });

  // voice:ready → 메인 스레드로 전달 (canTransmit 등 설정 정보)
  socket.on('voice:ready', (config: unknown) => {
    postMsg({ type: 'voice:ready', config });
  });

  // voice:data → 해당 senderId의 playback port로 직접 전달
  socket.on('voice:data', (data: { senderId: string; data: ArrayBuffer; timestamp: number }) => {
    const port = playbackPorts.get(data.senderId);
    if (port) {
      // Worker → AudioWorklet 직접 전달 (메인 스레드 우회)
      port.postMessage(
        { type: 'frame', pcm: data.data },
        [data.data]
      );
    } else {
      // Playback port가 아직 없으면 메인 스레드에 알려서 생성 요청
      postMsg({ type: 'new-sender', senderId: data.senderId, data: data.data, timestamp: data.timestamp });
    }
  });

  // voice:start/end/mute/unmute → 메인 스레드로 전달 (UI 업데이트용)
  socket.on('voice:start', (data: unknown) => {
    postMsg({ type: 'voice:start', data });
  });

  socket.on('voice:end', (data: unknown) => {
    postMsg({ type: 'voice:end', data });
  });

  socket.on('voice:mute', (data: unknown) => {
    postMsg({ type: 'voice:mute', data });
  });

  socket.on('voice:unmute', (data: unknown) => {
    postMsg({ type: 'voice:unmute', data });
  });
}

/**
 * Socket.IO 연결 해제
 */
function handleDisconnect(): void {
  capturePort = null;
  playbackPorts.clear();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Capture AudioWorklet과 직접 연결할 MessagePort 설정
 * AudioWorklet에서 캡처된 PCM 프레임이 이 포트로 직접 도착한다.
 */
function handleSetCapturePort(port: MessagePort): void {
  capturePort = port;
  capturePort.onmessage = (event: MessageEvent) => {
    if (event.data.type === 'frame') {
      // AudioWorklet → Worker → Server (메인 스레드 완전 우회)
      if (socket?.connected) {
        socket.volatile.emit('voice:data', event.data.pcm);
      }
      // RMS 레벨은 메인 스레드로 전달 (UI 미터 업데이트)
      if (event.data.rms !== undefined) {
        postMsg({ type: 'mic-level', rms: event.data.rms });
      }
    }
  };
}

/**
 * Playback AudioWorklet과 직접 연결할 MessagePort 설정
 * 특정 senderId의 PCM 프레임이 이 포트로 직접 전달된다.
 */
function handleSetPlaybackPort(senderId: string, port: MessagePort): void {
  playbackPorts.set(senderId, port);
}

/**
 * 메인 스레드로 메시지 전송 헬퍼
 */
function postMsg(data: Record<string, unknown>): void {
  (self as unknown as { postMessage: (msg: unknown) => void }).postMessage(data);
}

// TypeScript를 위한 export
export {};
