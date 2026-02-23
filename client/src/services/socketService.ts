// Socket.IO 클라이언트 싱글턴 (데모용)
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:7191';

let strokeSocket: Socket | null = null;
let controlSocket: Socket | null = null;

export function getStrokeSocket(sessionId: string, userId: string): Socket {
    if (!strokeSocket || !strokeSocket.connected) {
        strokeSocket = io(`${SOCKET_URL}/stroke`, {
            query: { sessionId, userId },
            transports: ['websocket'],
        });
    }
    return strokeSocket;
}

export function getControlSocket(sessionId: string, userId: string): Socket {
    if (!controlSocket || !controlSocket.connected) {
        controlSocket = io(`${SOCKET_URL}/control`, {
            query: { sessionId, userId },
            transports: ['websocket'],
        });
    }
    return controlSocket;
}

export function disconnectAll() {
    strokeSocket?.disconnect();
    controlSocket?.disconnect();
    strokeSocket = null;
    controlSocket = null;
}
