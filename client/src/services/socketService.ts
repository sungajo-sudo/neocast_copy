// Socket.IO 클라이언트 싱글턴 (데모용)
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:7191';

let strokeSocket: Socket | null = null;
let controlSocket: Socket | null = null;
let strokeSessionId: string | null = null;
let controlSessionId: string | null = null;

export function getStrokeSocket(sessionId: string, userId: string): Socket {
    // sessionId가 바뀐 경우에만 재연결 (connected 체크 제거 — socket.io가 자동 재연결 처리)
    if (!strokeSocket || strokeSessionId !== sessionId) {
        strokeSocket?.disconnect();
        strokeSocket = io(`${SOCKET_URL}/stroke`, {
            query: { sessionId, userId },
            transports: ['websocket'],
        });
        strokeSessionId = sessionId;
    }
    return strokeSocket;
}

export function getControlSocket(sessionId: string, userId: string): Socket {
    // sessionId가 바뀐 경우에만 재연결
    if (!controlSocket || controlSessionId !== sessionId) {
        controlSocket?.disconnect();
        controlSocket = io(`${SOCKET_URL}/control`, {
            query: { sessionId, userId },
            transports: ['websocket'],
        });
        controlSessionId = sessionId;
    }
    return controlSocket;
}

export function disconnectAll() {
    strokeSocket?.disconnect();
    controlSocket?.disconnect();
    strokeSocket = null;
    controlSocket = null;
    strokeSessionId = null;
    controlSessionId = null;
}
