import { io, type Socket } from 'socket.io-client';
import { authService } from './auth-service';
import { useFriendStore, type PresenceStatus, type FriendRequest } from '../stores/friend-store';
import { useMessengerStore, type DmAttachment, type Message, type MessageThread } from '../stores/messenger-store';
import { usePanelStore } from '../stores/panel-store';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

const SOCKET_URL = (() => {
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

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

/**
 * 메신저 서비스
 * Socket.IO를 통한 실시간 DM 및 프레즌스 관리
 */
class MessengerService {
  private socket: Socket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isTyping = false;
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getAccessToken(): string {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
      const error = data as ApiError;
      throw new Error(error.message || 'Request failed');
    }
    return data as T;
  }

  /**
   * 서버 metadata JSON을 파싱하여 attachments 배열 반환
   */
  private parseAttachments(metadata?: string | null): DmAttachment[] | undefined {
    if (!metadata) return undefined;
    try {
      const parsed = JSON.parse(metadata);
      if (parsed?.attachments && Array.isArray(parsed.attachments)) {
        return parsed.attachments;
      }
    } catch {
      // ignore invalid JSON
    }
    return undefined;
  }

  /**
   * 서버 메시지에 metadata가 있으면 attachments로 변환
   */
  private enrichMessage(msg: Message & { metadata?: string | null }): Message {
    const attachments = this.parseAttachments(msg.metadata);
    const { metadata: _metadata, ...rest } = msg as Message & { metadata?: string | null };
    return attachments ? { ...rest, attachments } : rest;
  }

  // ============================================
  // Socket.IO 연결 관리
  // ============================================

  /**
   * 메신저 소켓 연결
   */
  connect(): void {
    // 이미 소켓이 존재하면 (연결 중이거나 연결됨) 무시
    if (this.socket) {
      if (this.socket.connected) {
        console.log('[MessengerService] Already connected');
      } else {
        console.log('[MessengerService] Already connecting...');
      }
      return;
    }

    const token = this.getAccessToken();

    this.socket = io(`${SOCKET_URL}/messenger`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventHandlers();

    console.log('[MessengerService] Connecting...');
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    if (!this.socket) return;

    this.stopHeartbeat();
    this.clearTypingTimeout();

    this.socket.disconnect();
    this.socket = null;

    useFriendStore.getState().setConnected(false);
    console.log('[MessengerService] Disconnected');
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    const friendStore = useFriendStore.getState();
    const messengerStore = useMessengerStore.getState();

    // 연결 성공
    this.socket.on('connect', () => {
      console.log('[MessengerService] Connected, socket id:', this.socket?.id);
      friendStore.setConnected(true);
      this.startHeartbeat();
    });

    // 연결 에러
    this.socket.on('connect_error', (error) => {
      console.error('[MessengerService] Connection error:', error.message);
      friendStore.setConnected(false);
    });

    // 연결 해제
    this.socket.on('disconnect', (reason) => {
      console.log('[MessengerService] Disconnected:', reason);
      friendStore.setConnected(false);
      this.stopHeartbeat();
    });

    // 초기화 완료 (친구 상태 포함)
    this.socket.on('messenger:ready', (data: { friends: { friendId: string; name: string; status: PresenceStatus }[] }) => {
      console.log('[MessengerService] Ready with', data.friends.length, 'friends');
      // 친구들의 온라인 상태 업데이트
      data.friends.forEach((f) => {
        friendStore.updateFriendStatus(f.friendId, f.status);
      });
    });

    // 친구 상태 변경
    this.socket.on('friend:status', (data: { userId: string; status: PresenceStatus; timestamp: number }) => {
      console.log('[MessengerService] Friend status changed:', data.userId, data.status);
      friendStore.updateFriendStatus(data.userId, data.status, data.timestamp);
    });

    // DM 수신
    this.socket.on('dm:message', (raw: Message & { metadata?: string | null }) => {
      const message = this.enrichMessage(raw);
      console.log('[MessengerService] Received DM:', message.id);
      messengerStore.addMessage(message);
      messengerStore.incrementThreadUnread(message.threadId);

      // 글로벌 읽지 않은 메시지 배지 증가
      usePanelStore.getState().incrementUnreadMessenger();

      // 스레드가 없으면 스레드 목록 새로고침
      const existingThread = messengerStore.getThread(message.threadId);
      if (!existingThread) {
        this.loadThreads();
      }
    });

    // 친구 요청 수신
    this.socket.on('friend:request', (request: FriendRequest) => {
      console.log('[MessengerService] Received friend request:', request.id);
      friendStore.addReceivedRequest(request);
      // 글로벌 읽지 않은 메시지 배지 증가
      usePanelStore.getState().incrementUnreadMessenger();
    });

    // DM 전송 확인
    this.socket.on('dm:sent', (raw: Message & { metadata?: string | null }) => {
      const message = this.enrichMessage(raw);
      console.log('[MessengerService] DM sent:', message.id);
      messengerStore.addMessage(message);
      messengerStore.setSendingMessage(false);
    });

    // DM 에러
    this.socket.on('dm:error', (error: { code: string; message: string }) => {
      console.error('[MessengerService] DM error:', error);
      messengerStore.setSendingMessage(false);
    });

    // 타이핑 인디케이터
    this.socket.on('dm:typing', (data: { threadId: string; userId: string; isTyping: boolean }) => {
      messengerStore.setTyping(data.threadId, data.userId, data.isTyping);
    });

    // 읽음 알림
    this.socket.on('dm:read', (data: { threadId: string; readBy: string; readAt: string }) => {
      console.log('[MessengerService] Messages read in thread:', data.threadId);
      // 필요시 UI 업데이트 (예: 읽음 표시)
    });

    // 읽음 처리 확인
    this.socket.on('dm:readConfirm', (data: { threadId: string }) => {
      console.log('[MessengerService] Read confirmation for thread:', data.threadId);
    });

    // 에러
    this.socket.on('error', (error: { code: string; message: string }) => {
      console.error('[MessengerService] Socket error:', error);
    });
  }

  // ============================================
  // 하트비트
  // ============================================

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('presence:heartbeat');
      }
    }, 60000); // 1분마다
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ============================================
  // DM 기능
  // ============================================

  /**
   * 메시지 전송 (스레드 ID 기반)
   */
  sendMessage(threadId: string, content: string, attachments?: DmAttachment[]): boolean {
    if (!this.socket?.connected) {
      console.warn('[MessengerService] Cannot send message: socket not connected');
      return false;
    }
    if (!content.trim() && (!attachments || attachments.length === 0)) {
      console.warn('[MessengerService] Cannot send message: no content or attachments');
      return false;
    }

    const metadata = attachments?.length
      ? JSON.stringify({ attachments })
      : undefined;

    console.log('[MessengerService] Sending message to thread:', threadId);
    useMessengerStore.getState().setSendingMessage(true);
    this.socket.emit('dm:send', { threadId, content: content.trim(), metadata });
    this.stopTypingIndicator();
    return true;
  }

  /**
   * 친구에게 메시지 전송 (스레드 자동 생성)
   */
  sendMessageToFriend(friendId: string, content: string, attachments?: DmAttachment[]): boolean {
    if (!this.socket?.connected) return false;
    if (!content.trim() && (!attachments || attachments.length === 0)) return false;

    const metadata = attachments?.length
      ? JSON.stringify({ attachments })
      : undefined;

    useMessengerStore.getState().setSendingMessage(true);
    this.socket.emit('dm:sendToFriend', { friendId, content: content.trim(), metadata });
    this.stopTypingIndicator();
    return true;
  }

  /**
   * 타이핑 시작
   */
  startTypingIndicator(threadId: string): void {
    if (!this.socket?.connected) return;

    if (!this.isTyping) {
      this.isTyping = true;
      this.socket.emit('dm:typing', { threadId, isTyping: true });
    }

    this.clearTypingTimeout();
    this.typingTimeout = setTimeout(() => {
      this.stopTypingIndicator();
    }, 2000);
  }

  /**
   * 타이핑 중지
   */
  private stopTypingIndicator(): void {
    if (!this.socket?.connected || !this.isTyping) return;

    this.isTyping = false;
    this.clearTypingTimeout();
  }

  private clearTypingTimeout(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  /**
   * 메시지 읽음 처리
   */
  markAsRead(threadId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('dm:markRead', { threadId });
    useMessengerStore.getState().clearThreadUnread(threadId);
  }

  // ============================================
  // 프레즌스 기능
  // ============================================

  /**
   * 상태 변경
   */
  setStatus(status: 'online' | 'busy' | 'away'): void {
    if (!this.socket?.connected) return;
    this.socket.emit('presence:setStatus', { status });
  }

  // ============================================
  // REST API
  // ============================================

  /**
   * DM 대화 목록 조회
   */
  async getDmThreads(): Promise<MessageThread[]> {
    const response = await fetch(`${this.baseUrl}/messages/threads`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{ success: boolean; threads: MessageThread[] }>(response);
    // DM 스레드에 type 추가
    return data.threads.map((t) => ({ ...t, type: 'dm' as const }));
  }

  /**
   * 세션 채팅 대화 목록 조회
   */
  async getSessionChatThreads(): Promise<MessageThread[]> {
    const response = await fetch(`${this.baseUrl}/session-chat/threads`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{
      success: boolean;
      threads: {
        id: string;
        type: 'session';
        sessionCode: string;
        hostName: string;
        participantNames: string[];
        lastMessage: string;
        lastMessageAt: string;
        messageCount: number;
      }[];
    }>(response);
    // 세션 채팅 스레드를 MessageThread 형식으로 변환
    return data.threads.map((t) => ({
      id: t.id,
      type: 'session' as const,
      participantId: '', // 세션 채팅에서는 사용 안함
      participantEmail: '',
      participantName: t.hostName,
      sessionCode: t.sessionCode,
      hostName: t.hostName,
      participantNames: t.participantNames,
      lastMessage: t.lastMessage,
      lastMessageAt: t.lastMessageAt,
      unreadCount: 0, // 세션 채팅은 읽지 않음 카운트 없음 (추후 추가 가능)
      createdAt: t.lastMessageAt,
    }));
  }

  /**
   * 모든 대화 목록 조회 (DM + 세션 채팅)
   */
  async getThreads(): Promise<MessageThread[]> {
    const [dmThreads, sessionThreads] = await Promise.all([
      this.getDmThreads().catch(() => [] as MessageThread[]),
      this.getSessionChatThreads().catch(() => [] as MessageThread[]),
    ]);

    // 최근 메시지 순으로 정렬
    const allThreads = [...dmThreads, ...sessionThreads];
    allThreads.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return allThreads;
  }

  /**
   * 대화 목록 로드 및 스토어 업데이트
   */
  async loadThreads(): Promise<void> {
    const store = useMessengerStore.getState();
    store.setLoadingThreads(true);
    try {
      const threads = await this.getThreads();
      store.setThreads(threads);
    } finally {
      store.setLoadingThreads(false);
    }
  }

  /**
   * 특정 대화의 메시지 목록 조회
   */
  async getMessages(threadId: string, options?: { limit?: number; before?: string }): Promise<{ messages: Message[]; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);

    const url = `${this.baseUrl}/messages/threads/${threadId}${params.toString() ? `?${params}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{
      success: boolean;
      messages: (Message & { metadata?: string | null })[];
      hasMore: boolean;
    }>(response);
    return {
      messages: data.messages.map((m) => this.enrichMessage(m)),
      hasMore: data.hasMore,
    };
  }

  /**
   * 세션 채팅 메시지 목록 조회
   */
  async getSessionChatMessages(
    sessionId: string,
    options?: { limit?: number; before?: string }
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);

    const url = `${this.baseUrl}/session-chat/${sessionId}/messages${params.toString() ? `?${params}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{
      success: boolean;
      messages: {
        id: string;
        sessionId: string;
        userId: string;
        userName: string;
        content: string;
        type: string;
        metadata: unknown;
        createdAt: string;
      }[];
      hasMore: boolean;
    }>(response);

    // 세션 채팅 메시지를 Message 형식으로 변환
    const messages: Message[] = data.messages.map((m) => ({
      id: m.id,
      threadId: m.sessionId,
      senderId: m.userId,
      senderName: m.userName,
      content: m.content,
      readAt: null,
      createdAt: m.createdAt,
    }));

    return { messages, hasMore: data.hasMore };
  }

  /**
   * 메시지 로드 및 스토어 업데이트
   */
  async loadMessages(threadId: string, isSessionChat = false): Promise<void> {
    const store = useMessengerStore.getState();
    store.setLoadingMessages(true);
    try {
      const { messages, hasMore } = isSessionChat
        ? await this.getSessionChatMessages(threadId)
        : await this.getMessages(threadId);
      store.setMessages(threadId, messages, hasMore);
    } finally {
      store.setLoadingMessages(false);
    }
  }

  /**
   * 이전 메시지 로드 (페이지네이션)
   */
  async loadMoreMessages(threadId: string, isSessionChat = false): Promise<boolean> {
    const store = useMessengerStore.getState();
    const existingMessages = store.getMessages(threadId);

    if (existingMessages.length === 0 || !store.hasMore(threadId)) {
      return false;
    }

    const oldestMessage = existingMessages[0];
    store.setLoadingMessages(true);

    try {
      const { messages, hasMore } = isSessionChat
        ? await this.getSessionChatMessages(threadId, {
            before: oldestMessage.id,
            limit: 50,
          })
        : await this.getMessages(threadId, {
            before: oldestMessage.id,
            limit: 50,
          });
      store.prependMessages(threadId, messages, hasMore);
      return messages.length > 0;
    } finally {
      store.setLoadingMessages(false);
    }
  }

  /**
   * 특정 사용자와 대화 시작
   */
  async startConversation(userId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/messages/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
      body: JSON.stringify({ userId }),
    });
    const data = await this.handleResponse<{ success: boolean; threadId: string }>(response);
    return data.threadId;
  }

  /**
   * 특정 사용자와의 스레드 ID 조회
   */
  async getThreadIdWithUser(userId: string): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/messages/thread-with/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{ success: boolean; threadId: string | null }>(response);
    return data.threadId;
  }

  /**
   * 전체 읽지 않은 메시지 수 조회
   */
  async getUnreadCount(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/messages/unread-count`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
    const data = await this.handleResponse<{ success: boolean; count: number }>(response);
    return data.count;
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * 초기 읽지 않은 개수 로드 (로그인 시 호출)
   * 받은 친구 요청 + 읽지 않은 메시지 수를 합산하여 배지에 표시
   */
  async initializeUnreadCount(): Promise<void> {
    try {
      // 읽지 않은 메시지 수 조회
      const unreadMessages = await this.getUnreadCount();

      // 받은 친구 요청 수 조회
      const response = await fetch(`${this.baseUrl}/friends/requests`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getAccessToken()}`,
        },
      });
      const data = await this.handleResponse<{ success: boolean; requests: unknown[] }>(response);
      const pendingRequestCount = data.requests.length;

      // 총 읽지 않은 수 설정
      const totalUnread = unreadMessages + pendingRequestCount;
      usePanelStore.getState().setUnreadMessengerCount(totalUnread);

      console.log('[MessengerService] Initialized unread count:', { unreadMessages, pendingRequestCount, totalUnread });
    } catch (error) {
      console.error('[MessengerService] Failed to initialize unread count:', error);
    }
  }
}

// 싱글톤 인스턴스
export const messengerService = new MessengerService();
