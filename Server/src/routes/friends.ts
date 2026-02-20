import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as friendService from '../services/friend.service.js';
import * as presenceService from '../services/presence.service.js';
import * as authService from '../services/auth.service.js';
import { ValidationError } from '../utils/errors.js';
import { emitFriendRequest } from '../socket/index.js';

// 친구 요청 스키마
const sendRequestSchema = z.object({
  email: z.string().email(),
  message: z.string().max(500).optional(),
});

// 친구 관계 업데이트 스키마
const updateFriendshipSchema = z.object({
  relationFlags: z.number().int().min(0).optional(),
  groupId: z.string().uuid().nullable().optional(),
});

/**
 * 친구 인증 헬퍼
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
 * 친구 관리 API 라우트
 */
export const friendRoutes: FastifyPluginAsync = async (app) => {
  // 친구 목록 조회 (with 온라인 상태)
  app.get('/', async (request, reply) => {
    const userId = getAuthUserId(request);
    const friends = await friendService.getFriends(userId);

    // 온라인 상태 조회 (Redis 실패 시 기본값 사용)
    let presenceMap = new Map<string, { status: string; lastSeen: number }>();
    try {
      const friendIds = friends.map((f) => f.friendId);
      if (friendIds.length > 0) {
        presenceMap = await presenceService.getPresenceBulk(friendIds);
      }
    } catch (err) {
      request.log.warn({ err }, 'Failed to get presence info, using offline as default');
    }

    const friendsWithStatus = friends.map((f) => ({
      ...f,
      status: presenceMap.get(f.friendId)?.status ?? 'offline',
      lastSeen: presenceMap.get(f.friendId)?.lastSeen ?? 0,
    }));

    return reply.send({
      success: true,
      friends: friendsWithStatus,
    });
  });

  // 친구 요청 보내기
  app.post('/request', async (request, reply) => {
    const userId = getAuthUserId(request);

    const result = sendRequestSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const friendRequest = await friendService.sendFriendRequest(userId, result.data.email, result.data.message);

    // 상대방이 이미 요청을 보낸 경우 자동 수락됨 - 소켓 알림은 보내지 않음
    // 새로운 요청인 경우에만 소켓으로 알림 전송
    if (friendRequest.status === 'PENDING') {
      emitFriendRequest(friendRequest.toUserId, friendRequest);
    }

    return reply.status(201).send({
      success: true,
      request: friendRequest,
    });
  });

  // 받은 친구 요청 목록
  app.get('/requests', async (request, reply) => {
    const userId = getAuthUserId(request);
    const requests = await friendService.getReceivedRequests(userId);

    return reply.send({
      success: true,
      requests,
    });
  });

  // 보낸 친구 요청 목록
  app.get('/requests/sent', async (request, reply) => {
    const userId = getAuthUserId(request);
    const requests = await friendService.getSentRequests(userId);

    return reply.send({
      success: true,
      requests,
    });
  });

  // 친구 요청 수락
  app.post('/requests/:id/accept', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { id } = request.params as { id: string };

    const friendRequest = await friendService.acceptRequest(id, userId);

    return reply.send({
      success: true,
      request: friendRequest,
    });
  });

  // 친구 요청 거절
  app.post('/requests/:id/reject', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { id } = request.params as { id: string };

    const friendRequest = await friendService.rejectRequest(id, userId);

    return reply.send({
      success: true,
      request: friendRequest,
    });
  });

  // 보낸 친구 요청 취소
  app.delete('/requests/:id', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { id } = request.params as { id: string };

    await friendService.cancelSentRequest(id, userId);

    return reply.send({
      success: true,
      message: 'Request cancelled',
    });
  });

  // 친구 삭제
  app.delete('/:friendId', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { friendId } = request.params as { friendId: string };

    await friendService.removeFriend(userId, friendId);

    return reply.send({
      success: true,
      message: 'Friend removed',
    });
  });

  // 친구 관계 수정 (그룹, 관계 플래그)
  app.patch('/:friendId', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { friendId } = request.params as { friendId: string };

    const result = updateFriendshipSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const friend = await friendService.updateFriendship(userId, friendId, result.data);

    return reply.send({
      success: true,
      friend,
    });
  });

  // 사용자 검색 (친구 추가용)
  app.get('/search', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { email } = request.query as { email?: string };

    if (!email) {
      throw new ValidationError('Email query parameter required');
    }

    const user = await friendService.searchUserByEmail(email, userId);

    return reply.send({
      success: true,
      user, // null if not found
    });
  });
};
