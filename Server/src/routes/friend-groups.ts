import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as friendService from '../services/friend.service.js';
import * as authService from '../services/auth.service.js';
import { ValidationError } from '../utils/errors.js';

// 그룹 생성 스키마
const createGroupSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// 그룹 수정 스키마
const updateGroupSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
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
 * 친구 그룹 API 라우트
 */
export const friendGroupRoutes: FastifyPluginAsync = async (app) => {
  // 그룹 목록 조회
  app.get('/', async (request, reply) => {
    const userId = getAuthUserId(request);
    const groups = await friendService.getFriendGroups(userId);

    return reply.send({
      success: true,
      groups,
    });
  });

  // 그룹 생성
  app.post('/', async (request, reply) => {
    const userId = getAuthUserId(request);

    const result = createGroupSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const group = await friendService.createFriendGroup(userId, result.data.name, result.data.color);

    return reply.status(201).send({
      success: true,
      group,
    });
  });

  // 그룹 수정
  app.patch('/:id', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { id } = request.params as { id: string };

    const result = updateGroupSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const group = await friendService.updateFriendGroup(userId, id, result.data);

    return reply.send({
      success: true,
      group,
    });
  });

  // 그룹 삭제
  app.delete('/:id', async (request, reply) => {
    const userId = getAuthUserId(request);
    const { id } = request.params as { id: string };

    await friendService.deleteFriendGroup(userId, id);

    return reply.send({
      success: true,
      message: 'Group deleted',
    });
  });
};
