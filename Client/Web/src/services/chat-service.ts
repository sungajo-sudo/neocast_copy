import type { Socket } from 'socket.io-client';
import { useChatStore } from '../stores/chat-store';
import type { ChatMessage, DirectMessage, ChatAttachment } from '../stores/chat-store';
import { usePanelStore } from '../stores/panel-store';
import { useMessengerStore, type Message, type MessageThread } from '../stores/messenger-store';
import { useSessionStore } from '../stores/session-store';

/**
 * 채팅 서비스
 * Socket.IO를 통한 실시간 채팅 기능 관리
 */
class ChatService {
  private socket: Socket | null = null;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isTyping = false;

  /**
   * 채팅 소켓 연결
   */
  connect(socket: Socket): void {
    if (this.socket === socket) {
      return;
    }

    this.socket = socket;
    this.setupEventHandlers();

    console.log('[ChatService] Connected');
    useChatStore.getState().setConnected(true);
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    if (!this.socket) return;

    this.socket.off('chat:ready');
    this.socket.off('chat:history');
    this.socket.off('chat:message');
    this.socket.off('chat:dm');
    this.socket.off('chat:dm:sent');
    this.socket.off('chat:dm:error');
    this.socket.off('chat:typing');

    this.socket = null;
    this.clearTypingTimeout();

    console.log('[ChatService] Disconnected');
    useChatStore.getState().setConnected(false);
    useChatStore.getState().reset();
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    const store = useChatStore.getState();
    const panelStore = usePanelStore.getState();

    // 연결 준비 완료
    this.socket.on('chat:ready', ({ sessionId }) => {
      console.log('[ChatService] Ready for session:', sessionId);
    });

    // 채팅 히스토리 수신
    this.socket.on('chat:history', (messages: ChatMessage[]) => {
      console.log('[ChatService] Received history:', messages.length, 'messages');
      store.setMessages(messages);
    });

    // 새 메시지 수신
    this.socket.on('chat:message', (message: ChatMessage) => {
      console.log('[ChatService] Received message:', message);
      store.addMessage(message);

      // 채팅 패널이 닫혀 있으면 읽지 않은 메시지 카운트 증가
      const currentPanel = usePanelStore.getState().activeRightPanel;
      if (currentPanel !== 'chat') {
        panelStore.incrementUnreadChat();
      }

      // 메신저 스토어도 업데이트 (세션 채팅 실시간 동기화)
      const messengerStore = useMessengerStore.getState();
      const sessionThread = messengerStore.threads.find(
        (t) => t.type === 'session' && t.id === message.sessionId
      );

      const messageTimestamp = new Date(message.timestamp).toISOString();

      if (sessionThread) {
        // 스레드의 lastMessage 및 lastMessageAt 업데이트
        messengerStore.updateThread(message.sessionId, {
          lastMessage: message.content,
          lastMessageAt: messageTimestamp,
        });
      } else {
        // 스레드가 없으면 새로 생성
        const sessionStore = useSessionStore.getState();
        const session = sessionStore.session;

        if (session && session.id === message.sessionId) {
          // 현재 세션의 참가자 이름 목록 생성
          const participantNames = session.participants.map((p) => p.userName);
          const hostParticipant = session.participants.find(
            (p) => p.userId === session.hostId
          );

          const newThread: MessageThread = {
            id: message.sessionId,
            type: 'session',
            participantId: '',
            participantEmail: '',
            participantName: hostParticipant?.userName || 'Host',
            sessionCode: session.code,
            hostName: hostParticipant?.userName || 'Host',
            participantNames,
            lastMessage: message.content,
            lastMessageAt: messageTimestamp,
            unreadCount: 0,
            createdAt: messageTimestamp,
          };

          messengerStore.addOrUpdateThread(newThread);
          console.log('[ChatService] Created new session thread for messenger:', session.code);
        }
      }

      // 메신저 메시지 목록에도 추가
      const messengerMessage: Message = {
        id: message.id,
        threadId: message.sessionId,
        senderId: message.userId,
        senderName: message.userName,
        content: message.content,
        readAt: null,
        createdAt: messageTimestamp,
      };
      messengerStore.addMessage(messengerMessage);
    });

    // DM 수신
    this.socket.on('chat:dm', (dm: DirectMessage) => {
      console.log('[ChatService] Received DM from:', dm.fromUserName);
      store.addDirectMessage(dm, false);
    });

    // DM 전송 확인
    this.socket.on('chat:dm:sent', (dm: DirectMessage) => {
      console.log('[ChatService] DM sent to:', dm.toUserId);
      store.addDirectMessage(dm, true);
    });

    // DM 에러
    this.socket.on('chat:dm:error', (error: { code: string; message: string }) => {
      console.error('[ChatService] DM error:', error);
    });

    // 타이핑 인디케이터
    this.socket.on('chat:typing', ({ userId, userName, isTyping }) => {
      store.setTyping(userId, userName, isTyping);
    });
  }

  /**
   * 채팅 메시지 전송
   */
  sendMessage(content: string): boolean {
    if (!this.socket || !content.trim()) {
      return false;
    }

    this.socket.emit('chat:message', { content: content.trim() });
    this.stopTyping();
    return true;
  }

  /**
   * DM 전송
   */
  sendDirectMessage(toUserId: string, content: string): boolean {
    if (!this.socket || !content.trim() || !toUserId) {
      return false;
    }

    this.socket.emit('chat:dm', {
      toUserId,
      content: content.trim(),
    });
    return true;
  }

  /**
   * 파일 메시지 전송
   */
  sendFileMessage(attachments: ChatAttachment[], content?: string): boolean {
    if (!this.socket || !attachments.length) {
      return false;
    }

    this.socket.emit('chat:file', {
      attachments,
      content: content?.trim() || '',
    });
    return true;
  }

  /**
   * 타이핑 시작 알림
   */
  startTyping(): void {
    if (!this.socket) return;

    if (!this.isTyping) {
      this.isTyping = true;
      this.socket.emit('chat:typing', { isTyping: true });
    }

    // 기존 타임아웃 클리어
    this.clearTypingTimeout();

    // 2초 후 자동으로 타이핑 중지
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 2000);
  }

  /**
   * 타이핑 중지 알림
   */
  stopTyping(): void {
    if (!this.socket || !this.isTyping) return;

    this.isTyping = false;
    this.socket.emit('chat:typing', { isTyping: false });
    this.clearTypingTimeout();
  }

  /**
   * 타이핑 타임아웃 클리어
   */
  private clearTypingTimeout(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// 싱글톤 인스턴스
export const chatService = new ChatService();
