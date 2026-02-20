import { create } from 'zustand';

/**
 * 메신저 탭 타입
 */
export type MessengerTab = 'friends' | 'messages';

/**
 * 스레드 타입
 */
export type ThreadType = 'dm' | 'session';

/**
 * 메시지 스레드 정보 (DM 및 세션 채팅 통합)
 */
export interface MessageThread {
  id: string;
  type: ThreadType;
  // DM 전용 필드
  participantId: string;
  participantEmail: string;
  participantName: string;
  // 세션 채팅 전용 필드
  sessionCode?: string;
  hostName?: string;
  participantNames?: string[];
  // 공통 필드
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
}

/**
 * DM 첨부파일 정보
 */
export interface DmAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

/**
 * 메시지 정보
 */
export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  attachments?: DmAttachment[];
  readAt: string | null;
  createdAt: string;
}

/**
 * 타이핑 인디케이터 정보
 */
export interface TypingIndicator {
  threadId: string;
  userId: string;
  isTyping: boolean;
  timestamp: number;
}

/**
 * 메신저 스토어 인터페이스
 */
interface MessengerStore {
  // UI 상태
  activeTab: MessengerTab;
  selectedThreadId: string | null;
  selectedFriendId: string | null; // 친구 목록에서 선택한 친구 (새 대화 시작용)

  // 메시지 데이터
  threads: MessageThread[];
  messagesByThread: Map<string, Message[]>;
  hasMoreByThread: Map<string, boolean>;
  typingIndicators: Map<string, TypingIndicator>;

  // 로딩 상태
  isLoadingThreads: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;

  // 총 읽지 않은 메시지 수
  totalUnreadCount: number;

  // UI 액션
  setActiveTab: (tab: MessengerTab) => void;
  setSelectedThreadId: (threadId: string | null) => void;
  setSelectedFriendId: (friendId: string | null) => void;
  selectFriendAndSwitchToMessages: (friendId: string, threadId?: string) => void;

  // 스레드 액션
  setThreads: (threads: MessageThread[]) => void;
  updateThread: (threadId: string, updates: Partial<MessageThread>) => void;
  addOrUpdateThread: (thread: MessageThread) => void;
  incrementThreadUnread: (threadId: string) => void;
  clearThreadUnread: (threadId: string) => void;

  // 메시지 액션
  setMessages: (threadId: string, messages: Message[], hasMore: boolean) => void;
  prependMessages: (threadId: string, messages: Message[], hasMore: boolean) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;

  // 타이핑 인디케이터
  setTyping: (threadId: string, userId: string, isTyping: boolean) => void;
  getTypingInThread: (threadId: string) => TypingIndicator | undefined;

  // 로딩 상태
  setLoadingThreads: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setSendingMessage: (sending: boolean) => void;

  // 유틸리티
  getThread: (threadId: string) => MessageThread | undefined;
  getThreadByParticipant: (participantId: string) => MessageThread | undefined;
  getMessages: (threadId: string) => Message[];
  hasMore: (threadId: string) => boolean;
  updateTotalUnreadCount: () => void;

  // 리셋
  reset: () => void;
  resetMessages: () => void;
}

// 타이핑 인디케이터 타임아웃 (3초)
const TYPING_TIMEOUT = 3000;

const initialState = {
  activeTab: 'friends' as MessengerTab,
  selectedThreadId: null as string | null,
  selectedFriendId: null as string | null,
  threads: [] as MessageThread[],
  messagesByThread: new Map<string, Message[]>(),
  hasMoreByThread: new Map<string, boolean>(),
  typingIndicators: new Map<string, TypingIndicator>(),
  isLoadingThreads: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  totalUnreadCount: 0,
};

export const useMessengerStore = create<MessengerStore>((set, get) => ({
  ...initialState,

  // UI 액션
  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedThreadId: (threadId) => {
    set({ selectedThreadId: threadId });
    // 스레드 선택 시 해당 스레드의 읽지 않은 메시지 초기화
    if (threadId) {
      get().clearThreadUnread(threadId);
    }
  },

  setSelectedFriendId: (friendId) => set({ selectedFriendId: friendId }),

  selectFriendAndSwitchToMessages: (friendId, threadId) => {
    set({
      selectedFriendId: friendId,
      selectedThreadId: threadId ?? null,
      activeTab: 'messages',
    });
    if (threadId) {
      get().clearThreadUnread(threadId);
    }
  },

  // 스레드 액션
  setThreads: (threads) => {
    set({ threads });
    get().updateTotalUnreadCount();
  },

  updateThread: (threadId, updates) => {
    set((state) => ({
      threads: state.threads.map((t) => (t.id === threadId ? { ...t, ...updates } : t)),
    }));
  },

  addOrUpdateThread: (thread) => {
    set((state) => {
      const existing = state.threads.find((t) => t.id === thread.id);
      if (existing) {
        return {
          threads: state.threads.map((t) => (t.id === thread.id ? thread : t)),
        };
      }
      return {
        threads: [thread, ...state.threads],
      };
    });
    get().updateTotalUnreadCount();
  },

  incrementThreadUnread: (threadId) => {
    const { selectedThreadId } = get();
    // 현재 보고 있는 스레드가 아닐 때만 증가
    if (selectedThreadId !== threadId) {
      set((state) => ({
        threads: state.threads.map((t) =>
          t.id === threadId ? { ...t, unreadCount: t.unreadCount + 1 } : t
        ),
      }));
      get().updateTotalUnreadCount();
    }
  },

  clearThreadUnread: (threadId) => {
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId ? { ...t, unreadCount: 0 } : t
      ),
    }));
    get().updateTotalUnreadCount();
  },

  // 메시지 액션
  setMessages: (threadId, messages, hasMore) => {
    set((state) => {
      const newMessagesMap = new Map(state.messagesByThread);
      newMessagesMap.set(threadId, messages);
      const newHasMoreMap = new Map(state.hasMoreByThread);
      newHasMoreMap.set(threadId, hasMore);
      return {
        messagesByThread: newMessagesMap,
        hasMoreByThread: newHasMoreMap,
      };
    });
  },

  prependMessages: (threadId, messages, hasMore) => {
    set((state) => {
      const newMessagesMap = new Map(state.messagesByThread);
      const existing = newMessagesMap.get(threadId) || [];
      newMessagesMap.set(threadId, [...messages, ...existing]);
      const newHasMoreMap = new Map(state.hasMoreByThread);
      newHasMoreMap.set(threadId, hasMore);
      return {
        messagesByThread: newMessagesMap,
        hasMoreByThread: newHasMoreMap,
      };
    });
  },

  addMessage: (message) => {
    set((state) => {
      const newMessagesMap = new Map(state.messagesByThread);
      const existing = newMessagesMap.get(message.threadId) || [];
      newMessagesMap.set(message.threadId, [...existing, message]);

      // 스레드 목록 업데이트
      const lastMessage = message.content || (message.attachments?.length ? `📎 ${message.attachments[0].filename}` : '');
      const threads = state.threads.map((t) =>
        t.id === message.threadId
          ? {
              ...t,
              lastMessage,
              lastMessageAt: message.createdAt,
            }
          : t
      );

      // 스레드를 최신 메시지 순으로 정렬
      threads.sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

      return {
        messagesByThread: newMessagesMap,
        threads,
      };
    });
  },

  updateMessage: (messageId, updates) => {
    set((state) => {
      const newMessagesMap = new Map(state.messagesByThread);
      for (const [threadId, messages] of newMessagesMap) {
        const updatedMessages = messages.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        );
        newMessagesMap.set(threadId, updatedMessages);
      }
      return { messagesByThread: newMessagesMap };
    });
  },

  // 타이핑 인디케이터
  setTyping: (threadId, userId, isTyping) => {
    set((state) => {
      const newIndicators = new Map(state.typingIndicators);
      const key = `${threadId}:${userId}`;

      if (isTyping) {
        newIndicators.set(key, {
          threadId,
          userId,
          isTyping: true,
          timestamp: Date.now(),
        });

        // 자동 타임아웃
        setTimeout(() => {
          const { typingIndicators } = get();
          const indicator = typingIndicators.get(key);
          if (indicator && Date.now() - indicator.timestamp >= TYPING_TIMEOUT) {
            set((s) => {
              const updated = new Map(s.typingIndicators);
              updated.delete(key);
              return { typingIndicators: updated };
            });
          }
        }, TYPING_TIMEOUT);
      } else {
        newIndicators.delete(key);
      }

      return { typingIndicators: newIndicators };
    });
  },

  getTypingInThread: (threadId) => {
    const { typingIndicators } = get();
    for (const [, indicator] of typingIndicators) {
      if (indicator.threadId === threadId && indicator.isTyping) {
        return indicator;
      }
    }
    return undefined;
  },

  // 로딩 상태
  setLoadingThreads: (loading) => set({ isLoadingThreads: loading }),
  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
  setSendingMessage: (sending) => set({ isSendingMessage: sending }),

  // 유틸리티
  getThread: (threadId) => {
    return get().threads.find((t) => t.id === threadId);
  },

  getThreadByParticipant: (participantId) => {
    return get().threads.find((t) => t.participantId === participantId);
  },

  getMessages: (threadId) => {
    return get().messagesByThread.get(threadId) || [];
  },

  hasMore: (threadId) => {
    return get().hasMoreByThread.get(threadId) ?? true;
  },

  updateTotalUnreadCount: () => {
    const { threads } = get();
    const total = threads.reduce((sum, t) => sum + t.unreadCount, 0);
    set({ totalUnreadCount: total });
  },

  // 리셋
  reset: () => set(initialState),

  resetMessages: () => {
    set({
      messagesByThread: new Map(),
      hasMoreByThread: new Map(),
      typingIndicators: new Map(),
    });
  },
}));
