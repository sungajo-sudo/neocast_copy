import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens } from '../types/auth';
import { authService } from '../services/auth-service';
import { messengerService } from '../services/messenger-service';
import { useFriendStore } from './friend-store';
import { useMessengerStore } from './messenger-store';

interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isGuest: boolean; // 게스트 사용자 여부
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  loginAsGuest: (userId: string, accessToken: string, displayName: string) => void; // 게스트 로그인 (userId는 실제 UUID)
  /** 개발환경 전용: 백엔드 없이 인증 상태를 직접 설정 */
  devMockLogin: (role: 'host' | 'guest') => void;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  updateUser: (data: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<boolean>;
  deleteAccount: (password: string) => Promise<boolean>;
  clearError: () => void;
  setServerUrl: (url: string) => void;
}

const STORAGE_KEY = 'penstream-auth';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isGuest: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(email, password);
          set({
            user: response.user,
            tokens: response.tokens,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null });
        try {
          await authService.register(email, password, name);
          // 회원가입 성공 후 자동 로그인
          const loginResponse = await authService.login(email, password);
          set({
            user: loginResponse.user,
            tokens: loginResponse.tokens,
            isAuthenticated: true,
            isGuest: false,
            isLoading: false,
          });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Registration failed';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      devMockLogin: (role) => {
        const mockUsers = {
          host: { id: 'mock-host-0000', email: 'host@abc.com', name: '선생님 (Mock)', createdAt: new Date().toISOString() },
          guest: { id: 'mock-guest-0000', email: 'guest@abc.com', name: '학생 (Mock)', createdAt: new Date().toISOString() },
        };
        set({
          user: mockUsers[role],
          tokens: { accessToken: 'mock-dev-token', refreshToken: 'mock-dev-refresh' },
          isAuthenticated: true,
          isGuest: false,
          isLoading: false,
          error: null,
        });
      },

      loginAsGuest: (userId, accessToken, displayName) => {
        // userId는 실제 UUID, displayName은 "@guest-0001" 형식의 표시 이름
        set({
          user: {
            id: userId,
            email: `guest-${userId.slice(0, 8)}@guest.local`,
            name: displayName,
            createdAt: new Date().toISOString(),
          },
          tokens: {
            accessToken,
            refreshToken: '', // 게스트는 리프레시 토큰 없음
          },
          isAuthenticated: true,
          isGuest: true,
          error: null,
        });
      },

      logout: () => {
        // 메신저 소켓 연결 해제
        messengerService.disconnect();

        // 친구 및 메신저 스토어 초기화
        useFriendStore.getState().reset();
        useMessengerStore.getState().reset();

        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isGuest: false,
          error: null,
        });
      },

      refreshToken: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) {
          return false;
        }

        try {
          const newTokens = await authService.refreshToken(tokens.refreshToken);
          set({ tokens: newTokens });
          return true;
        } catch (error) {
          // 리프레시 실패 시 로그아웃
          set({
            user: null,
            tokens: null,
            isAuthenticated: false,
          });
          return false;
        }
      },

      updateUser: async (data) => {
        const { tokens } = get();
        if (!tokens?.accessToken) {
          set({ error: 'Not authenticated' });
          return false;
        }

        set({ isLoading: true, error: null });
        try {
          const updatedUser = await authService.updateMe(tokens.accessToken, data);
          set({ user: updatedUser, isLoading: false });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Update failed';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      deleteAccount: async (password) => {
        const { tokens } = get();
        if (!tokens?.accessToken) {
          set({ error: 'Not authenticated' });
          return false;
        }

        set({ isLoading: true, error: null });
        try {
          await authService.deleteMe(tokens.accessToken, password);
          set({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Delete failed';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      clearError: () => set({ error: null }),

      setServerUrl: (url) => {
        const apiUrl = url.replace(/\/$/, '') + '/api';
        authService.setBaseUrl(apiUrl);
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => {
        // 게스트 세션은 localStorage에 저장하지 않음
        if (state.isGuest) {
          return {
            user: null,
            tokens: null,
            isAuthenticated: false,
            isGuest: false,
          };
        }
        return {
          user: state.user,
          tokens: state.tokens,
          isAuthenticated: state.isAuthenticated,
          isGuest: state.isGuest,
        };
      },
      // 저장된 상태 복원 시 게스트 세션이면 무시
      onRehydrateStorage: () => (state) => {
        if (state?.isGuest) {
          state.user = null;
          state.tokens = null;
          state.isAuthenticated = false;
          state.isGuest = false;
        }
      },
    }
  )
);
