import { create } from 'zustand';

/**
 * 채팅 첨부파일 타입
 */
export interface ChatAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

/**
 * 채팅 메시지 타입
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  type: 'message' | 'system' | 'file';
  attachments?: ChatAttachment[];
}

/**
 * 다이렉트 메시지 타입
 */
export interface DirectMessage {
  id: string;
  sessionId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  content: string;
  timestamp: number;
  read: boolean;
}

/**
 * 타이핑 인디케이터 타입
 */
export interface TypingIndicator {
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: number;
}

/**
 * DM 대화 타입
 */
export interface DMConversation {
  participantId: string;
  participantName: string;
  messages: DirectMessage[];
  unreadCount: number;
  lastMessageAt: number;
}

/**
 * 채팅 스토어 인터페이스
 */
interface ChatStore {
  // 상태
  messages: ChatMessage[];
  typingUsers: Map<string, TypingIndicator>;
  isConnected: boolean;

  // DM 상태
  dmConversations: Map<string, DMConversation>;
  totalUnreadDmCount: number;

  // 액션
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;

  // 타이핑 인디케이터
  setTyping: (userId: string, userName: string, isTyping: boolean) => void;
  clearTyping: () => void;

  // DM 액션
  addDirectMessage: (dm: DirectMessage, isSent: boolean) => void;
  markDmAsRead: (participantId: string) => void;
  getDmConversation: (participantId: string) => DMConversation | undefined;

  // 연결 상태
  setConnected: (connected: boolean) => void;

  // 리셋
  reset: () => void;
}

// 타이핑 인디케이터 타임아웃 (3초)
const TYPING_TIMEOUT = 3000;

export const useChatStore = create<ChatStore>((set, get) => ({
  // 초기 상태
  messages: [],
  typingUsers: new Map(),
  isConnected: false,
  dmConversations: new Map(),
  totalUnreadDmCount: 0,

  // 메시지 추가
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  // 메시지 목록 설정 (히스토리 로드)
  setMessages: (messages) => {
    set({ messages });
  },

  // 메시지 클리어
  clearMessages: () => {
    set({ messages: [] });
  },

  // 타이핑 인디케이터 설정
  setTyping: (userId, userName, isTyping) => {
    set((state) => {
      const newTypingUsers = new Map(state.typingUsers);

      if (isTyping) {
        newTypingUsers.set(userId, {
          userId,
          userName,
          isTyping: true,
          timestamp: Date.now(),
        });

        // 3초 후 자동으로 타이핑 상태 제거
        setTimeout(() => {
          const { typingUsers } = get();
          const user = typingUsers.get(userId);
          if (user && Date.now() - user.timestamp >= TYPING_TIMEOUT) {
            set((s) => {
              const updated = new Map(s.typingUsers);
              updated.delete(userId);
              return { typingUsers: updated };
            });
          }
        }, TYPING_TIMEOUT);
      } else {
        newTypingUsers.delete(userId);
      }

      return { typingUsers: newTypingUsers };
    });
  },

  // 모든 타이핑 인디케이터 클리어
  clearTyping: () => {
    set({ typingUsers: new Map() });
  },

  // DM 추가
  addDirectMessage: (dm, isSent) => {
    set((state) => {
      const conversationId = isSent ? dm.toUserId : dm.fromUserId;
      const conversationName = isSent ? '' : dm.fromUserName; // 받은 메시지면 보낸 사람 이름 사용

      const conversations = new Map(state.dmConversations);
      const existing = conversations.get(conversationId);

      const updatedConversation: DMConversation = existing
        ? {
            ...existing,
            messages: [...existing.messages, dm],
            unreadCount: isSent ? existing.unreadCount : existing.unreadCount + 1,
            lastMessageAt: dm.timestamp,
          }
        : {
            participantId: conversationId,
            participantName: conversationName || dm.fromUserName,
            messages: [dm],
            unreadCount: isSent ? 0 : 1,
            lastMessageAt: dm.timestamp,
          };

      conversations.set(conversationId, updatedConversation);

      // 총 읽지 않은 메시지 수 계산
      let totalUnread = 0;
      conversations.forEach((conv) => {
        totalUnread += conv.unreadCount;
      });

      return {
        dmConversations: conversations,
        totalUnreadDmCount: totalUnread,
      };
    });
  },

  // DM 읽음 처리
  markDmAsRead: (participantId) => {
    set((state) => {
      const conversations = new Map(state.dmConversations);
      const existing = conversations.get(participantId);

      if (existing) {
        conversations.set(participantId, {
          ...existing,
          unreadCount: 0,
        });

        // 총 읽지 않은 메시지 수 재계산
        let totalUnread = 0;
        conversations.forEach((conv) => {
          totalUnread += conv.unreadCount;
        });

        return {
          dmConversations: conversations,
          totalUnreadDmCount: totalUnread,
        };
      }

      return state;
    });
  },

  // DM 대화 가져오기
  getDmConversation: (participantId) => {
    return get().dmConversations.get(participantId);
  },

  // 연결 상태 설정
  setConnected: (connected) => {
    set({ isConnected: connected });
  },

  // 리셋
  reset: () => {
    set({
      messages: [],
      typingUsers: new Map(),
      isConnected: false,
      dmConversations: new Map(),
      totalUnreadDmCount: 0,
    });
  },
}));
