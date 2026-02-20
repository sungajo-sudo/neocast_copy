import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as sessionService from '../services/session.service.js';
import * as permissionService from '../services/permission.service.js';
import { verifyAccessToken, generateTokens } from '../services/auth.service.js';
import { ValidationError, AuthenticationError, AuthorizationError } from '../utils/errors.js';
import { broadcastRoleChange, broadcastParticipantKick } from '../socket/index.js';

// 세션 생성 요청 스키마
const createSessionSchema = z.object({
  password: z.string().min(1).max(100).optional(), // 세션 비밀번호
  maxGuests: z.number().min(1).max(100).optional(), // 최대 게스트 수
  allowGuestVoice: z.boolean().optional(), // 게스트 음성 허용 여부
  allowGuestMode: z.boolean().optional(), // 게스트 모드(로그인 없는 참여) 허용 여부
  autoArchive: z.boolean().optional(), // 자동 아카이브 여부
  linkedArchiveId: z.string().uuid().optional(), // 연결된 아카이브 ID
});

// 게스트로 세션 참여 요청 스키마
const joinAsGuestSchema = z.object({
  code: z.string().length(6), // 세션 코드 (6자리)
  password: z.string().optional(), // 세션 비밀번호 (설정된 경우)
  inviteToken: z.string().optional(), // 초대 토큰
  displayName: z.string().max(50).optional(), // 게스트 표시 이름
});

// 로그인된 사용자로 세션 참여 요청 스키마
const joinSessionSchema = z.object({
  code: z.string().length(6), // 세션 코드 (6자리)
  password: z.string().optional(), // 세션 비밀번호
  inviteToken: z.string().optional(), // 초대 토큰
});

// 권한 부여 요청 스키마
const permissionSchema = z.object({
  guestId: z.string().uuid(), // 권한을 받을 게스트 ID
  sourceId: z.string().uuid(), // 권한 대상 소스 ID
});

// 세션 설정 업데이트 요청 스키마
const updateSettingsSchema = z.object({
  maxGuests: z.number().min(1).max(100).optional(),
  allowGuestVoice: z.boolean().optional(),
  autoArchive: z.boolean().optional(),
});

/**
 * 요청 헤더에서 인증 토큰을 추출하고 검증하여 사용자 정보를 반환합니다.
 * @param request Fastify 요청 객체
 * @returns 인증된 사용자 정보 (Payload)
 * @throws AuthenticationError 토큰이 없거나 유효하지 않은 경우
 */
function getAuthUser(request: { headers: { authorization?: string } }) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Authorization required');
  }
  return verifyAccessToken(authHeader.slice(7));
}

/**
 * 세션 관련 API 라우트를 정의합니다.
 */
export const sessionRoutes: FastifyPluginAsync = async (app) => {
  // 세션 생성
  app.post('/', async (request, reply) => {
    const user = getAuthUser(request);
    const result = createSessionSchema.safeParse(request.body || {});
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const session = await sessionService.createSession(user.userId, result.data);

    return reply.status(201).send({
      success: true,
      session: {
        id: session.id,
        code: session.code,
        hasPassword: session.hasPassword,
        inviteToken: session.inviteToken, // 비밀번호가 필요한 세션에 대한 초대 링크 생성용
        status: session.status,
        hostId: session.hostId,
        maxGuests: session.maxGuests,
        allowGuestVoice: session.allowGuestVoice,
        allowGuestMode: session.allowGuestMode,
        createdAt: session.createdAt,
      },
    });
  });

  // 세션 코드로 공개 정보 조회 (인증 불필요)
  // 비밀번호 설정 여부나 게스트 모드 허용 여부 등을 확인하기 위해 사용
  app.get('/code/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const session = await sessionService.getSessionPublicInfo(code);
    if (!session) {
      throw new ValidationError('Session not found');
    }

    return reply.send({
      success: true,
      session,
    });
  });

  // 세션 상세 정보 조회 (ID로 조회)
  // 참가자만 조회 가능
  app.get('/:id', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    const session = await sessionService.getSessionById(id);
    if (!session) {
      throw new ValidationError('Session not found');
    }

    // 참가자 여부 확인
    const isParticipant = await sessionService.isParticipant(id, user.userId);
    if (!isParticipant) {
      throw new ValidationError('Not a participant');
    }

    // 호스트에게만 inviteToken 포함하여 반환
    const isHost = await sessionService.isHost(id, user.userId);
    const responseSession = isHost ? session : { ...session, inviteToken: null };

    return reply.send({
      success: true,
      session: responseSession,
    });
  });

  // 세션 참여 (로그인된 사용자)
  app.post('/join', async (request, reply) => {
    const user = getAuthUser(request);
    const result = joinSessionSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const session = await sessionService.getSessionByCode(result.data.code);
    if (!session) {
      throw new ValidationError('Session not found');
    }

    // 비밀번호 또는 초대 토큰 검증
    const publicInfo = await sessionService.getSessionPublicInfo(result.data.code);
    if (publicInfo?.hasPassword) {
      // 초대 토큰 우선 확인 (비밀번호 없이 참여 가능)
      if (result.data.inviteToken) {
        const isValidToken = await sessionService.verifyInviteToken(session.id, result.data.inviteToken);
        if (!isValidToken) {
          throw new ValidationError('Invalid invite token');
        }
      } else if (result.data.password) {
        const isValid = await sessionService.verifySessionPassword(session.id, result.data.password);
        if (!isValid) {
          throw new ValidationError('Invalid password');
        }
      } else {
        throw new ValidationError('Password required');
      }
    }

    const participant = await sessionService.joinSession(session.id, user.userId);

    // 전체 참가자 정보를 포함한 세션 정보 조회
    const fullSession = await sessionService.getSessionById(session.id);

    return reply.send({
      success: true,
      session: {
        id: session.id,
        code: session.code,
        hasPassword: publicInfo?.hasPassword ?? false,
        status: session.status,
        hostId: session.hostId,
        maxGuests: session.maxGuests,
        allowGuestVoice: session.allowGuestVoice,
        createdAt: session.createdAt,
        participants: fullSession?.participants.map(p => ({
          id: p.id,
          userId: p.userId,
          userName: p.user.name,
          role: p.role.toLowerCase(),
          joinedAt: p.joinedAt,
        })) ?? [],
      },
      participant,
    });
  });

  // 게스트로 세션 참여 (인증 불필요)
  app.post('/join-as-guest', async (request, reply) => {
    const result = joinAsGuestSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const session = await sessionService.getSessionByCode(result.data.code);
    if (!session) {
      throw new ValidationError('Session not found');
    }

    // 게스트 모드 허용 여부 확인
    const publicInfo = await sessionService.getSessionPublicInfo(result.data.code);
    if (!publicInfo?.allowGuestMode) {
      throw new AuthorizationError('This session does not allow guest mode');
    }

    // 비밀번호 또는 초대 토큰 검증
    if (publicInfo?.hasPassword) {
      // 초대 토큰 우선 확인
      if (result.data.inviteToken) {
        const isValidToken = await sessionService.verifyInviteToken(session.id, result.data.inviteToken);
        if (!isValidToken) {
          throw new ValidationError('Invalid invite token');
        }
      } else if (result.data.password) {
        const isValid = await sessionService.verifySessionPassword(session.id, result.data.password);
        if (!isValid) {
          throw new ValidationError('Invalid password');
        }
      } else {
        throw new ValidationError('Password required');
      }
    }

    // 게스트 ID 생성 및 사용자 정보 생성
    const guestId = await sessionService.generateGuestId();
    const guestUser = await sessionService.createGuestUser(guestId, result.data.displayName);

    // 게스트로 세션 참여
    const participant = await sessionService.joinSessionAsGuest(session.id, guestUser.id);

    // 게스트용 액세스 토큰 발급
    const tokens = generateTokens({ userId: guestUser.id, email: guestUser.email });

    // 전체 세션 정보 조회
    const fullSession = await sessionService.getSessionById(session.id);

    return reply.send({
      success: true,
      guestId,
      accessToken: tokens.accessToken,
      session: {
        id: session.id,
        code: session.code,
        hasPassword: publicInfo?.hasPassword ?? false,
        status: session.status,
        hostId: session.hostId,
        maxGuests: session.maxGuests,
        allowGuestVoice: session.allowGuestVoice,
        allowGuestMode: session.allowGuestMode,
        createdAt: session.createdAt,
        participants: fullSession?.participants.map(p => ({
          id: p.id,
          userId: p.userId,
          userName: p.user.name,
          role: p.role.toLowerCase(),
          joinedAt: p.joinedAt,
        })) ?? [],
      },
      participant: {
        userId: guestUser.id,
        role: 'guest',
        joinedAt: participant.joinedAt,
      },
    });
  });

  // 세션 나가기
  app.post('/:id/leave', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    await sessionService.leaveSession(id, user.userId);

    return reply.send({
      success: true,
      message: 'Left session',
    });
  });

  // 세션 종료 (호스트 전용)
  app.delete('/:id', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    await sessionService.closeSession(id, user.userId);

    return reply.send({
      success: true,
      message: 'Session closed',
    });
  });

  // 세션 설정 업데이트 (호스트 전용)
  app.patch('/:id/settings', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    const result = updateSettingsSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    // 호스트 권한 확인
    const isHost = await sessionService.isHost(id, user.userId);
    if (!isHost) {
      throw new ValidationError('Only host can update settings');
    }

    // 데이터베이스 업데이트 (실제 코드에서는 session.service.ts로 이동 권장)
    const { prisma } = await import('../db/index.js');
    const session = await prisma.session.update({
      where: { id },
      data: result.data,
    });

    return reply.send({
      success: true,
      session,
    });
  });

  // 권한 부여
  app.post('/:id/permissions', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    const result = permissionSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const permission = await permissionService.grantPermission(
      id,
      user.userId,
      result.data.guestId,
      result.data.sourceId
    );

    return reply.status(201).send({
      success: true,
      permission,
    });
  });

  // 세션 권한 목록 조회
  app.get('/:id/permissions', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    // 호스트는 모든 권한 조회 가능
    const isHost = await sessionService.isHost(id, user.userId);
    if (!isHost) {
      // 게스트는 자신의 권한만 조회 가능
      const canReceiveFrom = await permissionService.getPermissionsForGuest(id, user.userId);
      return reply.send({
        success: true,
        permissions: [{ guestId: user.userId, canReceiveFrom }],
      });
    }

    const permissions = await permissionService.getSessionPermissions(id);

    return reply.send({
      success: true,
      permissions,
    });
  });

  // 권한 회수
  app.delete('/:id/permissions/:guestId/:sourceId', async (request, reply) => {
    const user = getAuthUser(request);
    const { id, guestId, sourceId } = request.params as {
      id: string;
      guestId: string;
      sourceId: string;
    };

    await permissionService.revokePermission(id, user.userId, guestId, sourceId);

    return reply.send({
      success: true,
      message: 'Permission revoked',
    });
  });

  // 재연결 가능한 세션 확인 (호스트용)
  // 비정상 종료된 세션이 있는지 확인하여 사용자에게 재연결 프롬프트 표시
  app.get('/reconnectable', async (request, reply) => {
    const user = getAuthUser(request);

    const disconnectedSession = await sessionService.getDisconnectedHostSession(user.userId);

    if (!disconnectedSession) {
      return reply.send({
        success: true,
        hasDisconnectedSession: false,
        session: null,
      });
    }

    return reply.send({
      success: true,
      hasDisconnectedSession: true,
      session: disconnectedSession,
    });
  });

  // 호스트 세션 재연결
  app.post('/:id/reconnect', async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params as { id: string };

    const session = await sessionService.reconnectHostToSession(id, user.userId);

    if (!session) {
      throw new ValidationError('Session not found or cannot reconnect');
    }

    return reply.send({
      success: true,
      session: {
        id: session.id,
        code: session.code,
        hasPassword: session.hasPassword,
        inviteToken: session.inviteToken,
        status: session.status,
        hostId: session.hostId,
        maxGuests: session.maxGuests,
        allowGuestVoice: session.allowGuestVoice,
        allowGuestMode: session.allowGuestMode,
        createdAt: session.createdAt,
        participants: session.participants.map((p) => ({
          id: p.id,
          userId: p.userId,
          userName: p.user.name,
          role: p.role.toLowerCase(),
          joinedAt: p.joinedAt,
        })),
      },
    });
  });

  // 참가자를 호스트로 승격 (호스트 전용)
  app.post('/:id/promote/:userId', async (request, reply) => {
    const user = getAuthUser(request);
    const { id, userId: targetUserId } = request.params as { id: string; userId: string };

    const participant = await sessionService.promoteToHost(id, user.userId, targetUserId);

    // 승격된 호스트를 위해 inviteToken 포함 세션 정보 조회
    const session = await sessionService.getSessionById(id);

    // 역할 변경 사항을 브로드캐스트 (새로운 호스트에게 inviteToken 전달)
    await broadcastRoleChange(id, targetUserId, 'host', session?.inviteToken);

    return reply.send({
      success: true,
      participant: {
        id: participant.id,
        userId: participant.userId,
        userName: participant.user.name,
        role: participant.role.toLowerCase(),
        joinedAt: participant.joinedAt,
      },
    });
  });

  // 호스트를 게스트로 강등 (원래 호스트 전용)
  app.post('/:id/demote/:userId', async (request, reply) => {
    const user = getAuthUser(request);
    const { id, userId: targetUserId } = request.params as { id: string; userId: string };

    const participant = await sessionService.demoteToGuest(id, user.userId, targetUserId);

    // 역할 변경 사항을 브로드캐스트
    broadcastRoleChange(id, targetUserId, 'guest');

    return reply.send({
      success: true,
      participant: {
        id: participant.id,
        userId: participant.userId,
        userName: participant.user.name,
        role: participant.role.toLowerCase(),
        joinedAt: participant.joinedAt,
      },
    });
  });

  // 참가자 퇴출 (호스트 전용)
  app.post('/:id/kick/:userId', async (request, reply) => {
    const user = getAuthUser(request);
    const { id, userId: targetUserId } = request.params as { id: string; userId: string };

    await sessionService.kickParticipant(id, user.userId, targetUserId);

    // 퇴출 브로드캐스트 및 소켓 강제 해제
    await broadcastParticipantKick(id, targetUserId);

    return reply.send({ success: true });
  });
};
