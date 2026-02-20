import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as archiveService from '../services/archive.service.js';
import { verifyAccessToken } from '../services/auth.service.js';
import { ValidationError, AuthenticationError } from '../utils/errors.js';

// 아카이브 목록 조회 쿼리 스키마
const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * 요청 헤더에서 인증 토큰을 검증하고 사용자 정보를 반환합니다.
 */
function getAuthUser(request: { headers: { authorization?: string } }) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Authorization required');
  }
  return verifyAccessToken(authHeader.slice(7));
}

/**
 * 아카이브(저장된 세션 데이터) 관련 라우트 핸들러
 */
export const archiveRoutes: FastifyPluginAsync = async (app) => {
  // 아카이브 목록 조회 (사용자 본인의 아카이브)
  app.get('/', async (request, reply) => {
    const user = getAuthUser(request);
    const result = listQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten().fieldErrors);
    }

    const { limit, offset } = result.data;
    const archives = await archiveService.listArchives(user.userId, limit, offset);

    return reply.send({
      success: true,
      archives,
      pagination: { limit, offset },
    });
  });

  // 아카이브 상세 정보 조회
  app.get('/:id', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    const archive = await archiveService.getArchiveById(id);
    if (!archive) {
      throw new ValidationError('Archive not found');
    }

    // 소유자만 조회 가능
    if (archive.hostId !== user.userId) {
      throw new ValidationError('Access denied');
    }

    return reply.send({
      success: true,
      archive,
    });
  });

  // 아카이브 전체 데이터 조회 (스트로크 데이터 포함)
  app.get('/:id/data', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    const archive = await archiveService.getArchiveById(id);
    if (!archive) {
      throw new ValidationError('Archive not found');
    }

    // 소유자 접근 권한 확인
    if (archive.hostId !== user.userId) {
      throw new ValidationError('Access denied');
    }

    const data = await archiveService.getArchiveData(id);

    return reply.send({
      success: true,
      archive,
      data,
    });
  });

  // 연결된 아카이브 체인 조회
  // (이어쓰기 등으로 연결된 아카이브 목록)
  app.get('/:id/chain', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    const archive = await archiveService.getArchiveById(id);
    if (!archive) {
      throw new ValidationError('Archive not found');
    }

    if (archive.hostId !== user.userId) {
      throw new ValidationError('Access denied');
    }

    const chain = await archiveService.getLinkedArchives(id);

    return reply.send({
      success: true,
      chain,
    });
  });

  // 아카이브에서 세션 복원 (이어쓰기)
  app.post('/:id/restore', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    const result = await archiveService.restoreFromArchive(id, user.userId);

    return reply.status(201).send({
      success: true,
      session: result,
    });
  });

  // 아카이브 삭제
  app.delete('/:id', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    await archiveService.deleteArchive(id, user.userId);

    return reply.send({
      success: true,
      message: 'Archive deleted',
    });
  });
};
