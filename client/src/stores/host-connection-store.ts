// 호스트 커넥션 어댑터 스토어
// source의 connection-store와 동일한 인터페이스 제공
// 소켓 이벤트 수신 → host-session-store / host-stroke-store 업데이트
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import { getStrokeSocket, getControlSocket } from '../services/socketService';
import { useSessionStore as useHostSessionStore } from './host-session-store';
import { useStrokeStore } from './host-stroke-store';
import { createMousePageAddress, PenType, StrokeFlags, MM_TO_PT } from '../types/neocast';
import type { Stroke } from '../types/neocast';

const PAGE_ADDRESS = createMousePageAddress(1);

function cssHexToArgb(hex: string): number {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // ARGB: alpha=0xFF, then R G B
  return ((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

interface HostConnectionState {
  controlSocket: Socket | null;
  init: (sessionId: string, userId: string) => void;
}

export const useConnectionStore = create<HostConnectionState>((set, get) => ({
  controlSocket: null,

  init: (sessionId, userId) => {
    // Idempotent: skip if already connected
    if (get().controlSocket) return;

    const strokeSock = getStrokeSocket(sessionId, userId);
    const controlSock = getControlSocket(sessionId, userId);

    // ── Control events: participant join/leave ──────────────────────────────
    controlSock.on('control', (msg: { type: string; userId: string; userName: string; role: string }) => {
      if (msg.type === 'PARTICIPANT_JOIN') {
        useHostSessionStore.getState().addParticipant({
          userId: msg.userId,
          userName: msg.userName,
          role: msg.role as 'host' | 'guest',
          joinedAt: Date.now(),
          isMuted: false,
          isSpeaking: false,
        });
      } else if (msg.type === 'PARTICIPANT_LEAVE') {
        useHostSessionStore.getState().removeParticipant(msg.userId);
      }
    });

    // ── Stroke events: receive guest strokes ────────────────────────────────
    strokeSock.on('stroke', (data: ArrayBuffer | Buffer) => {
      try {
        const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
        if (buf.length < 33) return;

        // First 32 bytes = senderId (null-padded)
        const senderId = new TextDecoder().decode(buf.slice(0, 32)).replace(/\0/g, '');
        const payload = new TextDecoder().decode(buf.slice(32));

        const json = JSON.parse(payload);
        if (!json || json.type !== 'stroke_complete') return;

        const stroke: Stroke = {
          id: json.strokeId,
          userId: senderId,
          ownerUserId: senderId,
          pageAddress: PAGE_ADDRESS,
          color: cssHexToArgb(json.color ?? '#1a1a1a'),
          thickness: (json.lineWidth ?? 2) / MM_TO_PT,
          penType: PenType.Pen,
          flags: StrokeFlags.None,
          startTimestamp: Date.now(),
          points: (json.points ?? []).map((p: { x: number; y: number; pressure?: number }) => ({
            x: p.x,
            y: p.y,
            pressure: Math.round((p.pressure ?? 0.5) * 32767),
            timestamp: Date.now(),
          })),
        };

        useStrokeStore.getState().addStroke(stroke);
      } catch {
        // ignore non-JSON or malformed packets
      }
    });

    set({ controlSocket: controlSock });
  },
}));
