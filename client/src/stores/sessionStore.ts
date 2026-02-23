import { create } from 'zustand';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:7191';

export interface SessionStore {
    sessionId: string | null;
    userId: string | null;
    nickname: string | null;
    role: 'host' | 'guest' | null;
    code: string | null;
    socketUrl: string;
    setSession: (s: Partial<Omit<SessionStore, 'setSession' | 'clearSession' | 'socketUrl'>>) => void;
    clearSession: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
    sessionId: null,
    userId: null,
    nickname: null,
    role: null,
    code: null,
    socketUrl: SOCKET_URL,
    setSession: (s) => set((prev) => ({ ...prev, ...s })),
    clearSession: () => set({ sessionId: null, userId: null, nickname: null, role: null, code: null }),
}));
