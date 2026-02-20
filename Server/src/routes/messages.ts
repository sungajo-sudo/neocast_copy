import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as messageService from '../services/message.service.js';
import * as authService from '../services/auth.service.js';
import { ValidationError } from '../utils/errors.js';

// 메시지 전송 스키마
const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

// 메시지 목록 쿼리 스키마
const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: z.string().uuid().optional(),
});

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
 * 메시지 API 라우트
 */
export const messageRoutes: FastifyPluginAsync = async (app) => {
  // 대화 목록 조회
  app.get('/threads', async (request, reply) => {
    const userId = getAuthUserId(request);
    const threads = await messageService.getThreads(userId);

    return reply.send({
      success: true,
      threads,
    });
  });

  // 전체 읽지 않은 메시지 수
  app.get('/unread-count', async (request, reply) => {
    const userId = getAuthUserId(request);
    const count = await messageService.getTotalUnreadCount(userId);

    return reply.send({
      success: true,
      count,
    });
  });

  // 특정 대화의 메시지 목록 (페이지네이션)
  app.get('/threads/:threadId', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { threadId } = request.params as { threadId: string };

    const queryResult = getMessagesQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      throw new ValidationError('Invalid query parameters', queryResult.error.flatten().fieldErrors);
    }

    const { messages, hasMore } = await messageService.getMessages(threadId, userId, queryResult.data);

    return reply.send({
      success: true,
      messages,
      hasMore,
    });
  });

  // 메시지 전송
  app.post('/threads/:threadId', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { threadId } = request.params as { threadId: string };

    const result = sendMessageSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const message = await messageService.sendMessage(threadId, userId, result.data.content);

    return reply.status(201).send({
      success: true,
      message,
    });
  });

  // 대화 읽음 처리
  app.post('/threads/:threadId/read', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { threadId } = request.params as { threadId: string };

    const count = await messageService.markThreadAsRead(threadId, userId);

    return reply.send({
      success: true,
      markedCount: count,
    });
  });

  // 특정 사용자와의 대화 시작/가져오기
  app.post('/start', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { userId: otherUserId } = request.body as { userId: string };

    if (!otherUserId) {
      throw new ValidationError('userId is required');
    }

    const threadId = await messageService.getOrCreateThread(userId, otherUserId);

    return reply.send({
      success: true,
      threadId,
    });
  });

  // 특정 사용자와의 스레드 ID 조회 (없으면 null)
  app.get('/thread-with/:userId', async (request, reply) => {
    const currentUserId = getAuthUserId(request);
    const { userId: otherUserId } = request.params as { userId: string };

    const threadId = await messageService.getThreadIdWithUser(currentUserId, otherUserId);

    return reply.send({
      success: true,
      threadId,
    });
  });
};
