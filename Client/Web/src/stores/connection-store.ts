import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { ConnectionState, ParticipantRole } from '../types';
import { useSessionStore } from './session-store';
import { chatService } from '../services/chat-service';
import { voiceService } from '../services/voice-service';
import { strokeService } from '../services/stroke-service';

const DEFAULT_SERVER_URL = (() => {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  if (!apiBaseUrl) {
    return 'http://localhost:8190';
  }

  if (apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')) {
    return apiBaseUrl.replace(/\/api\/?$/, '');
  }

  // Relative path (e.g. '/api') → use current origin (nginx proxy in production)
  if (apiBaseUrl.startsWith('/')) {
    return typeof window === 'undefined' ? '' : window.location.origin;
  }

  return apiBaseUrl;
})();

// Control 메시지 타입
interface ControlMessage {
  type: string;
  userId?: string;
  userName?: string;
  role?: string;
  reason?: string;
  hostId?: string; // HOST_DISCONNECTED 메시지용
  oldHostId?: string; // HOST_CHANGED 메시지용
  newHostId?: string; // HOST_CHANGED 메시지용
  newRole?: 'host' | 'guest'; // ROLE_CHANGED 메시지용
  inviteToken?: string | null; // ROLE_CHANGED 메시지용 - 호스트 승격 시 초대 토큰
  timestamp: number;
}

interface ConnectionStore {
  // 상태
  state: ConnectionState;
  serverUrl: string;
  token: string | null;
  sessionId: string | null;
  error: string | null;

  // 소켓 (voice와 stroke는 Worker에서 관리)
  controlSocket: Socket | null;
  chatSocket: Socket | null;

  // 액션
  connect: (serverUrl: string, token?: string, sessionId?: string) => Promise<boolean>;
  disconnect: () => void;
  setServerUrl: (url: string) => void;
  clearError: () => void;
  joinSession: (sessionId: string) => Promise<boolean>;
  leaveSession: () => Promise<void>;

  // 내부
  setState: (state: ConnectionState) => void;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  // 초기 상태
  state: ConnectionState.Disconnected,
  serverUrl: DEFAULT_SERVER_URL,
  token: null,
  sessionId: null,
  error: null,
  controlSocket: null,
  chatSocket: null,

  setState: (state) => set({ state }),
  setServerUrl: (url) => set({ serverUrl: url }),
  clearError: () => set({ error: null }),

  connect: async (serverUrl, token, sessionId) => {
    const { state } = get();
    if (state === ConnectionState.Connected || state === ConnectionState.Connecting) {
      return false;
    }

    set({ state: ConnectionState.Connecting, serverUrl, token: token || null, sessionId: sessionId || null, error: null });

    try {
      const options = {
        auth: { token },
        query: { sessionId },
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket'] as ('websocket' | 'polling')[],
      };

      // Control 네임스페이스 연결 (메인 스레드)
      const controlSocket = io(`${serverUrl}/control`, options);

      // Chat 네임스페이스 연결 (메인 스레드)
      const chatSocket = io(`${serverUrl}/chat`, options);

      // Voice/Stroke는 Worker에서 관리 (별도 연결)
      const workerAuth = { token };
      const workerQuery = { sessionId };

      controlSocket.on('connect', () => {
        console.log('[Control] Connected');
      });

      // Control 채널 메시지 핸들러 - 참가자 관리
      controlSocket.on('control', (message: ControlMessage) => {
        console.log('[Control] Received:', message);
        const sessionStore = useSessionStore.getState();

        switch (message.type) {
          case 'PARTICIPANT_JOIN':
            if (message.userId && message.userName) {
              sessionStore.addParticipant({
                userId: message.userId,
                userName: message.userName,
                role: (message.role as ParticipantRole) || ParticipantRole.Guest,
                joinedAt: message.timestamp,
                isMuted: false,
                isSpeaking: false,
              });
              console.log('[Control] Participant joined:', message.userName);
            }
            break;

          case 'PARTICIPANT_LEAVE':
            if (message.userId) {
              sessionStore.removeParticipant(message.userId);
              console.log('[Control] Participant left:', message.userId);
            }
            break;

          case 'PARTICIPANT_KICKED':
            if (message.userId) {
              const myUserId = sessionStore.currentUserId;
              if (message.userId === myUserId) {
                // 자신이 퇴출당한 경우 → 세션 나가기
                console.log('[Control] I was kicked from session');
                sessionStore.setKicked(true);
                get().disconnect();
              } else {
                // 다른 참가자가 퇴출된 경우
                sessionStore.removeParticipant(message.userId);
                console.log('[Control] Participant kicked:', message.userId);
              }
            }
            break;

          case 'HOST_DISCONNECTED':
            // Host temporarily disconnected - keep them in the list but mark as offline
            // They may reconnect later
            if (message.hostId) {
              sessionStore.setParticipantOnline(message.hostId, false);
              sessionStore.setSpotlightShare(null); // 주목공유 자동 해제
              console.log('[Control] Host disconnected, marked offline:', message.hostId);
            }
            break;

          case 'HOST_RECONNECTED':
            // Host reconnected - ensure they're in the participant list
            if (message.userId && message.userName) {
              // Try to add - if already in list, this is a no-op
              sessionStore.addParticipant({
                userId: message.userId,
                userName: message.userName,
                role: ParticipantRole.Host,
                joinedAt: message.timestamp,
                isMuted: false,
                isSpeaking: false,
              });
              console.log('[Control] Host reconnected:', message.userName);
            }
            break;

          case 'HOST_CHANGED':
            // Host transferred to co-host (when original host disconnects and there was a co-host)
            if (message.oldHostId && message.newHostId) {
              sessionStore.changeHost(message.newHostId);
              sessionStore.setSpotlightShare(null); // 주목공유 자동 해제
              console.log('[Control] Host changed from', message.oldHostId, 'to', message.newHostId);
            }
            break;

          case 'ROLE_CHANGED':
            // Participant role changed (promoted to host or demoted to guest)
            if (message.userId && message.newRole) {
              const newRole = message.newRole === 'host' ? ParticipantRole.Host : ParticipantRole.Guest;
              sessionStore.updateParticipant(message.userId, { role: newRole });
              console.log('[Control] Role changed:', message.userId, '->', message.newRole);

              // If the current user is promoted to host and inviteToken is included, update session
              const currentUserId = sessionStore.currentUserId;
              if (message.userId === currentUserId && message.newRole === 'host' && message.inviteToken) {
                useSessionStore.getState().setInviteToken(message.inviteToken);
                console.log('[Control] Received inviteToken for promoted host');
              }
            }
            break;

          case 'SPOTLIGHT_SHARE':
            sessionStore.setSpotlightShare(message.userId ?? null);
            break;

          case 'SESSION_STATUS':
            // TODO: Handle session status changes (closed, paused, etc.)
            console.log('[Control] Session status changed:', message);
            break;
        }
      });

      // 재연결 이벤트
      controlSocket.io.on('reconnect_attempt', (attempt) => {
        console.log('[Control] Reconnecting attempt:', attempt);
        set({ state: ConnectionState.Reconnecting });
      });

      controlSocket.io.on('reconnect', () => {
        console.log('[Control] Reconnected');
        set({ state: ConnectionState.Connected });
      });

      // 메인 스레드 소켓 연결 대기
      await Promise.all([
        waitForConnect(controlSocket),
        waitForConnect(chatSocket),
      ]);

      set({
        state: ConnectionState.Connected,
        controlSocket,
        chatSocket,
      });

      // 채팅 서비스 자동 연결
      chatService.connect(chatSocket);

      // 음성 서비스 자동 연결 (Worker에서 Socket.IO 연결)
      voiceService.connect(serverUrl, workerAuth, workerQuery);

      // Stroke 서비스 자동 연결 (Worker에서 Socket.IO 연결)
      strokeService.connect(serverUrl, workerAuth, workerQuery);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      console.error('Connection failed:', error);
      set({ state: ConnectionState.Disconnected, error: message });
      return false;
    }
  },

  disconnect: () => {
    const { controlSocket, chatSocket } = get();

    // 채팅 서비스 연결 해제
    chatService.disconnect();

    // 음성 서비스 연결 해제 (Worker 종료)
    voiceService.disconnect();

    // Stroke 서비스 연결 해제 (Worker 종료)
    strokeService.disconnect();

    controlSocket?.disconnect();
    chatSocket?.disconnect();

    set({
      state: ConnectionState.Disconnected,
      controlSocket: null,
      chatSocket: null,
      sessionId: null,
    });
  },

  joinSession: async (sessionId: string) => {
    const { controlSocket, state } = get();
    if (state !== ConnectionState.Connected || !controlSocket) {
      return false;
    }

    try {
      // 세션 참가 요청
      controlSocket.emit('control', {
        type: 'JOIN_SESSION',
        sessionId,
        timestamp: Date.now(),
      });
      set({ sessionId });
      return true;
    } catch (error) {
      console.error('Failed to join session:', error);
      return false;
    }
  },

  leaveSession: async () => {
    const { controlSocket, sessionId } = get();
    if (!controlSocket || !sessionId) {
      return;
    }

    try {
      // 세션 나가기 요청
      controlSocket.emit('control', {
        type: 'LEAVE_SESSION',
        sessionId,
        timestamp: Date.now(),
      });
      set({ sessionId: null });
    } catch (error) {
      console.error('Failed to leave session:', error);
    }
  },
}));

// 연결 완료 대기 유틸리티
function waitForConnect(socket: Socket, timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeout);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
