import { Namespace } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/auth.js';
import { getSessionRoom, getUserRoom } from '../index.js';
import { logger } from '../../utils/logger.js';
import * as sessionService from '../../services/session.service.js';
import * as sessionChatService from '../../services/session-chat.service.js';

// Chat attachment interface
export interface ChatAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

// Chat message interface
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

// Direct message interface
export interface DirectMessage {
  id: string;
  sessionId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  content: string;
  timestamp: number;
}

// In-memory chat history (per session)
// In production, consider using Redis or a database
const chatHistory = new Map<string, ChatMessage[]>();
const MAX_HISTORY = 100; // Keep last 100 messages per session

export function setupChatNamespace(namespace: Namespace): void {
  namespace.on('connection', async (rawSocket) => {
    const socket = rawSocket as unknown as AuthenticatedSocket;
    const userId = socket.user.userId;
    const sessionId = socket.handshake.query.sessionId as string;

    logger.info({ socketId: socket.id, userId, sessionId }, 'Chat namespace connection');

    if (!sessionId) {
      socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session ID required' });
      socket.disconnect();
      return;
    }

    // Fetch session and verify user is participant
    const session = await sessionService.getSessionById(sessionId);
    if (!session) {
      socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
      socket.disconnect();
      return;
    }

    const participant = session.participants.find((p) => p.userId === userId);
    if (!participant) {
      socket.emit('error', { code: 'PERMISSION_DENIED', message: 'Not a participant' });
      socket.disconnect();
      return;
    }

    const userName = participant.user.name || 'Anonymous';

    // Join session room
    socket.join(getSessionRoom(sessionId));
    socket.join(getUserRoom(userId));
    socket.sessionId = sessionId;

    // Send chat history to newly connected user
    // First check in-memory cache, then load from database
    let history = chatHistory.get(sessionId);
    if (!history || history.length === 0) {
      try {
        const dbHistory = await sessionChatService.getMessages(sessionId, { limit: MAX_HISTORY });
        history = dbHistory.messages.map((m) => ({
          id: m.id,
          sessionId: m.sessionId,
          userId: m.userId,
          userName: m.userName,
          content: m.content,
          timestamp: m.createdAt.getTime(),
          type: m.type as 'message' | 'system' | 'file',
          attachments: m.metadata?.attachments as ChatAttachment[] | undefined,
        }));
        // Update in-memory cache
        if (history.length > 0) {
          chatHistory.set(sessionId, history);
        }
      } catch (err) {
        logger.error({ err, sessionId }, 'Failed to load chat history from DB');
        history = [];
      }
    }
    socket.emit('chat:history', history);

    // Emit ready state
    socket.emit('chat:ready', { sessionId });

    // Handle chat message
    socket.on('chat:message', async (data: { content: string }) => {
      if (!data.content?.trim()) return;

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        userId,
        userName,
        content: data.content.trim(),
        timestamp: Date.now(),
        type: 'message',
      };

      // Store in history (in-memory for quick access)
      if (!chatHistory.has(sessionId)) {
        chatHistory.set(sessionId, []);
      }
      const history = chatHistory.get(sessionId)!;
      history.push(message);
      if (history.length > MAX_HISTORY) {
        history.shift();
      }

      // Broadcast to all participants in session
      namespace.to(getSessionRoom(sessionId)).emit('chat:message', message);

      // Save to database (async, don't block)
      sessionChatService.saveMessage(sessionId, userId, userName, message.content, 'message').catch((err) => {
        logger.error({ err, sessionId, userId }, 'Failed to save chat message to DB');
      });

      logger.debug({ sessionId, userId, messageId: message.id }, 'Chat message sent');
    });

    // Handle file message
    socket.on('chat:file', async (data: { attachments: ChatAttachment[]; content?: string }) => {
      if (!data.attachments?.length) return;

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        userId,
        userName,
        content: data.content?.trim() || '',
        timestamp: Date.now(),
        type: 'file',
        attachments: data.attachments,
      };

      // Store in history
      if (!chatHistory.has(sessionId)) {
        chatHistory.set(sessionId, []);
      }
      const history = chatHistory.get(sessionId)!;
      history.push(message);
      if (history.length > MAX_HISTORY) {
        history.shift();
      }

      // Broadcast to all participants in session
      namespace.to(getSessionRoom(sessionId)).emit('chat:message', message);

      // Save to database with attachments metadata (async, don't block)
      sessionChatService.saveMessage(sessionId, userId, userName, message.content, 'file', {
        attachments: data.attachments,
      }).catch((err) => {
        logger.error({ err, sessionId, userId }, 'Failed to save file message to DB');
      });

      logger.debug({ sessionId, userId, messageId: message.id, fileCount: data.attachments.length }, 'File message sent');
    });

    // Handle direct message (DM)
    socket.on('chat:dm', async (data: { toUserId: string; content: string }) => {
      if (!data.content?.trim() || !data.toUserId) return;

      // Verify target user is participant
      const isTargetParticipant = await sessionService.isParticipant(sessionId, data.toUserId);
      if (!isTargetParticipant) {
        socket.emit('chat:dm:error', { code: 'USER_NOT_FOUND', message: 'User not in session' });
        return;
      }

      const dm: DirectMessage = {
        id: crypto.randomUUID(),
        sessionId,
        fromUserId: userId,
        fromUserName: userName,
        toUserId: data.toUserId,
        content: data.content.trim(),
        timestamp: Date.now(),
      };

      // Send to recipient
      namespace.to(getUserRoom(data.toUserId)).emit('chat:dm', dm);
      // Send confirmation to sender
      socket.emit('chat:dm:sent', dm);

      logger.debug({ sessionId, from: userId, to: data.toUserId }, 'Direct message sent');
    });

    // Handle typing indicator
    socket.on('chat:typing', (data: { isTyping: boolean }) => {
      socket.to(getSessionRoom(sessionId)).emit('chat:typing', {
        userId,
        userName,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId, sessionId, reason }, 'Chat namespace disconnection');
    });

    socket.on('error', (error) => {
      logger.error({ socketId: socket.id, error }, 'Socket error in chat namespace');
    });
  });
}

// Utility to clear chat history when session ends
export function clearChatHistory(sessionId: string): void {
  chatHistory.delete(sessionId);
  logger.info({ sessionId }, 'Chat history cleared');
}

// Utility to send system message
export function sendSystemMessage(namespace: Namespace, sessionId: string, content: string): void {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    sessionId,
    userId: 'system',
    userName: 'System',
    content,
    timestamp: Date.now(),
    type: 'system',
  };

  if (!chatHistory.has(sessionId)) {
    chatHistory.set(sessionId, []);
  }
  chatHistory.get(sessionId)!.push(message);

  namespace.to(getSessionRoom(sessionId)).emit('chat:message', message);

  // Save system message to database (async)
  sessionChatService.saveMessage(sessionId, 'system', 'System', content, 'system').catch((err) => {
    logger.error({ err, sessionId }, 'Failed to save system message to DB');
  });
}
