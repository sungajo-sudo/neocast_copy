// 호스트 세션 어댑터 스토어
// source의 session-store와 동일한 인터페이스 제공
import { create } from 'zustand';

interface HostParticipant {
  userId: string;
  userName: string;
  role: 'host' | 'guest';
  joinedAt: number;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface HostSession {
  id: string;
  code: string;
  status: 'active';
  hostId: string;
  participants: HostParticipant[];
  createdAt: number;
}

interface HostSessionState {
  session: HostSession | null;
  currentUserId: string | null;
  selectedViewUserId: string | null;
  getViewableUserIds: () => string[];
  initSession: (sessionId: string, userId: string, code: string) => void;
  addParticipant: (p: HostParticipant) => void;
  removeParticipant: (userId: string) => void;
}

export const useSessionStore = create<HostSessionState>((set, get) => ({
  session: null,
  currentUserId: null,
  selectedViewUserId: null,

  getViewableUserIds: () => {
    const { session } = get();
    if (!session) return [];
    return session.participants.map((p) => p.userId);
  },

  initSession: (sessionId, userId, code) =>
    set({
      session: {
        id: sessionId,
        code,
        status: 'active',
        hostId: userId,
        participants: [],
        createdAt: Date.now(),
      },
      currentUserId: userId,
    }),

  addParticipant: (p) =>
    set((state) => ({
      session: state.session
        ? {
            ...state.session,
            participants: state.session.participants.find((x) => x.userId === p.userId)
              ? state.session.participants
              : [...state.session.participants, p],
          }
        : state.session,
    })),

  removeParticipant: (userId) =>
    set((state) => ({
      session: state.session
        ? {
            ...state.session,
            participants: state.session.participants.filter((p) => p.userId !== userId),
          }
        : state.session,
    })),
}));
