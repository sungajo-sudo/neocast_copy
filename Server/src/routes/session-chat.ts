import { FastifyPluginAsync } from 'fastify';
import * as sessionChatService from '../services/session-chat.service.js';
import * as authService from '../services/auth.service.js';
import { ValidationError } from '../utils/errors.js';

/**
 * 인증 헬퍼
 */
function getAuthUserId(request: { headers: { authorization?: string } }): string {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ValidationError('Authorization header required');
  }
  const token = authHeader.slice(7);
  const payload = authService.verifyAccessToken(token);
  return payload.userId;
}

/**
 * 세션 채팅 API 라우트
 */
export const sessionChatRoutes: FastifyPluginAsync = async (app) => {
  // 사용자의 세션 채팅 목록 (메신저용)
  app.get('/threads', async (request, reply) => {
    const userId = getAuthUserId(request);
    const sessionChats = await sessionChatService.getUserSessionChats(userId);

    return reply.send({
      success: true,
      threads: sessionChats.map((chat) => ({
        id: chat.sessionId,
        type: 'session',
        sessionCode: chat.sessionCode,
        hostName: chat.hostName,
        participantNames: chat.participantNames,
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt.toISOString(),
        messageCount: chat.messageCount,
      })),
    });
  });

  // 특정 세션의 채팅 메시지 조회
  app.get('/:sessionId/messages', async (request, reply) => {
    // 인증 확인 (세션 참여자만 조회 가능하도록 추후 확장 가능)
    getAuthUserId(request);
    const { sessionId } = request.params as { sessionId: string };
    const { limit, before } = request.query as { limit?: string; before?: string };

    const result = await sessionChatService.getMessages(sessionId, {
      limit: limit ? parseInt(limit, 10) : 50,
      before,
    });

    return reply.send({
      success: true,
      messages: result.messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        userId: m.userId,
        userName: m.userName,
        content: m.content,
        type: m.type,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
      hasMore: result.hasMore,
    });
  });
};
