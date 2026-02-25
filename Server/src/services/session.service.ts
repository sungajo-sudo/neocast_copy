import { SessionStatus, ParticipantRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../db/index.js';
import { config } from '../config/index.js';
import { NotFoundError, ConflictError, AuthorizationError, AuthenticationError } from '../utils/errors.js';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { getRedisClient } from '../utils/redis.js';

const BCRYPT_ROUNDS = 10;

export interface SessionInfo {
  id: string;
  code: string;
  hasPassword: boolean;
  inviteToken: string | null;
  hostId: string;
  status: SessionStatus;
  title: string;
  scheduledAt: Date | null;
  expectedParticipants: number | null;
  maxGuests: number;
  allowGuestVoice: boolean;
  allowGuestMode: boolean;
  autoArchive: boolean;
  linkedArchiveId: string | null;
  createdAt: Date;
  closedAt: Date | null;
}

export interface ParticipantInfo {
  id: string;
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  leftAt: Date | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SessionWithParticipants extends SessionInfo {
  participants: ParticipantInfo[];
  host: {
    id: string;
    name: string;
    email: string;
  };
}

const SESSION_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자 제외

/**
 * 세션 코드 생성 (랜덤 문자열)
 */
function generateSessionCode(length: number = config.session.codeLength): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SESSION_CODE_CHARS[Math.floor(Math.random() * SESSION_CODE_CHARS.length)];
  }
  return code;
}

/**
 * 유니크 세션 코드 보장
 */
async function ensureUniqueCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateSessionCode();
    const existing = await prisma.session.findUnique({ where: { code } });
    if (!existing) {
      return code;
    }
    attempts++;
  }
  throw new Error('Failed to generate unique session code');
}

// 랜덤 초대 토큰 생성 (16바이트 = 32 hex 문자)
function generateInviteToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 세션 생성 (호스트가 시작)
 */
export async function createSession(
  hostId: string,
  options?: {
    title?: string;
    scheduledAt?: Date;
    expectedParticipants?: number;
    password?: string;
    maxGuests?: number;
    allowGuestVoice?: boolean;
    allowGuestMode?: boolean;
    autoArchive?: boolean;
    linkedArchiveId?: string;
  }
): Promise<SessionWithParticipants & { hasPassword: boolean; inviteToken: string | null }> {
  const code = await ensureUniqueCode();

  // 비밀번호 해싱 (제공된 경우)
  const passwordHash = options?.password
    ? await bcrypt.hash(options.password, BCRYPT_ROUNDS)
    : null;

  // 비밀번호가 설정된 경우 초대 토큰 생성 (비밀번호 없이 초대 링크로 입장 가능하게 함)
  const inviteToken = passwordHash ? generateInviteToken() : null;

  // 이 호스트에 대한 오래된 연결 끊김 세션 Redis 키 정리
  await clearDisconnectedSessionsForHost(hostId);

  try {
    const session = await prisma.session.create({
      data: {
        code,
        passwordHash,
        inviteToken,
        hostId,
        title: options?.title ?? '',
        scheduledAt: options?.scheduledAt ?? null,
        expectedParticipants: options?.expectedParticipants ?? null,
        maxGuests: options?.maxGuests ?? config.session.maxGuests,
        allowGuestVoice: options?.allowGuestVoice ?? true,
        allowGuestMode: options?.allowGuestMode ?? true,
        autoArchive: options?.autoArchive ?? true,
        linkedArchiveId: options?.linkedArchiveId,
        participants: {
          create: {
            userId: hostId,
            role: ParticipantRole.HOST,
          },
        },
      },
      include: {
        host: {
          select: { id: true, name: true, email: true },
        },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    // Redis에 활성 세션 정보 캐싱
    const redis = getRedisClient();
    await redis.hset(`session:${session.id}`, {
      code: session.code,
      hostId: session.hostId,
      status: session.status,
    });

    logger.info({ sessionId: session.id, code: session.code, hostId }, 'Session created');

    return { ...session, hasPassword: !!passwordHash, inviteToken };
  } catch (error) {
    // 외래 키 제약 조건 위반 처리 (사용자 없음)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new AuthenticationError('User not found. Please login again.');
    }
    throw error;
  }
}

/**
 * 코드로 세션 공개 정보 조회 (비밀번호 필요 여부 확인용)
 */
export async function getSessionPublicInfo(code: string): Promise<{
  id: string;
  code: string;
  hasPassword: boolean;
  status: SessionStatus;
  participantCount: number;
  allowGuestMode: boolean;
  hostName: string;
} | null> {
  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      participants: { where: { leftAt: null } },
      host: { select: { name: true } },
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    code: session.code,
    hasPassword: !!session.passwordHash,
    status: session.status,
    participantCount: session.participants.length,
    allowGuestMode: session.allowGuestMode,
    hostName: session.host.name,
  };
}

/**
 * 세션 비밀번호 검증
 */
export async function verifySessionPassword(sessionId: string, password: string): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { passwordHash: true },
  });

  if (!session) {
    throw new NotFoundError('Session');
  }

  if (!session.passwordHash) {
    return true; // 비밀번호 없음
  }

  return bcrypt.compare(password, session.passwordHash);
}

export async function getSessionById(sessionId: string): Promise<SessionWithParticipants | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      host: { select: { id: true, name: true, email: true } },
      participants: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!session) return null;
  // 응답에서 passwordHash 제외
  const { passwordHash: _, ...sessionWithoutPassword } = session;
  return { ...sessionWithoutPassword, hasPassword: !!session.passwordHash, inviteToken: session.inviteToken };
}

export async function getSessionByCode(code: string): Promise<SessionWithParticipants | null> {
  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      host: { select: { id: true, name: true, email: true } },
      participants: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!session) return null;
  return { ...session, hasPassword: !!session.passwordHash, inviteToken: session.inviteToken };
}

/**
 * 세션 초대 토큰 검증
 */
export async function verifyInviteToken(sessionId: string, token: string): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { inviteToken: true },
  });

  if (!session || !session.inviteToken) {
    return false;
  }

  return session.inviteToken === token;
}

/**
 * 세션 참가 (일반 사용자)
 */
export async function joinSession(sessionId: string, userId: string): Promise<ParticipantInfo> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: { where: { leftAt: null } },
    },
  });

  if (!session) {
    throw new NotFoundError('Session');
  }

  if (session.status !== SessionStatus.ACTIVE) {
    throw new ConflictError('Session is not active');
  }

  // 이미 활성 참가자인지 확인
  const existingActive = session.participants.find((p) => p.userId === userId);
  if (existingActive) {
    // 기존 참가자 정보 반환
    const participant = await prisma.participant.findUnique({
      where: { id: existingActive.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return participant!;
  }

  // 이전에 떠난 참가자인지 확인 (leftAt이 설정됨)
  const previousParticipant = await prisma.participant.findFirst({
    where: { sessionId, userId, leftAt: { not: null } },
  });

  if (previousParticipant) {
    // leftAt을 초기화하여 다시 활성화
    // 항상 GUEST로 재참가 (HOST 역할이 필요하면 다시 승급해야 함)
    const participant = await prisma.participant.update({
      where: { id: previousParticipant.id },
      data: { leftAt: null, role: ParticipantRole.GUEST },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    logger.info({ sessionId, userId, participantId: participant.id, previousRole: previousParticipant.role }, 'User rejoined session as GUEST');
    return participant;
  }

  // 게스트 제한 확인
  const guestCount = session.participants.filter((p) => p.role === ParticipantRole.GUEST).length;
  if (guestCount >= session.maxGuests) {
    throw new ConflictError('Session is full');
  }

  const participant = await prisma.participant.create({
    data: {
      sessionId,
      userId,
      role: ParticipantRole.GUEST,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  logger.info({ sessionId, userId, participantId: participant.id }, 'User joined session');

  return participant;
}

/**
 * 세션 퇴장
 * 호스트가 퇴장하면 세션이 종료됩니다.
 */
export async function leaveSession(sessionId: string, userId: string): Promise<void> {
  const participant = await prisma.participant.findFirst({
    where: { sessionId, userId, leftAt: null },
    include: { session: true },
  });

  if (!participant) {
    throw new NotFoundError('Participant');
  }

  // 호스트가 나가면 세션 종료
  if (participant.role === ParticipantRole.HOST) {
    await closeSession(sessionId, userId);
    return;
  }

  await prisma.participant.update({
    where: { id: participant.id },
    data: { leftAt: new Date() },
  });

  logger.info({ sessionId, userId }, 'User left session');
}

/**
 * 세션 종료 (호스트 전용)
 */
export async function closeSession(sessionId: string, userId: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session');
  }

  if (session.hostId !== userId) {
    throw new AuthorizationError('Only host can close session');
  }

  if (session.status === SessionStatus.CLOSED || session.status === SessionStatus.ARCHIVED) {
    return;
  }

  await prisma.$transaction([
    prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.CLOSED, closedAt: new Date() },
    }),
    prisma.participant.updateMany({
      where: { sessionId, leftAt: null },
      data: { leftAt: new Date() },
    }),
  ]);

  // Redis 캐시에서 제거
  const redis = getRedisClient();
  await redis.del(`session:${sessionId}`);

  logger.info({ sessionId, userId }, 'Session closed');
}

export async function updateSessionStatus(
  sessionId: string,
  userId: string,
  status: SessionStatus
): Promise<SessionInfo> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session) {
    throw new NotFoundError('Session');
  }

  if (session.hostId !== userId) {
    throw new AuthorizationError('Only host can update session status');
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: { status },
  });

  // Redis 캐시 업데이트
  const redis = getRedisClient();
  await redis.hset(`session:${sessionId}`, 'status', status);

  logger.info({ sessionId, status }, 'Session status updated');

  return { ...updated, hasPassword: !!updated.passwordHash };
}

export async function getActiveSessionsCount(): Promise<number> {
  return prisma.session.count({
    where: { status: SessionStatus.ACTIVE },
  });
}

export async function getActiveSessions(limit: number = 100, offset: number = 0): Promise<SessionWithParticipants[]> {
  const sessions = await prisma.session.findMany({
    where: { status: SessionStatus.ACTIVE },
    include: {
      host: { select: { id: true, name: true, email: true } },
      participants: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
  return sessions.map((session) => ({ ...session, hasPassword: !!session.passwordHash }));
}

export async function isHost(sessionId: string, userId: string): Promise<boolean> {
  // 원래 호스트 ID인지 확인
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { hostId: true },
  });

  if (session?.hostId === userId) {
    return true;
  }

  // 참가자 중 HOST 역할이 있는지 확인 (다중 호스트 지원)
  const participant = await prisma.participant.findFirst({
    where: { sessionId, userId, leftAt: null, role: ParticipantRole.HOST },
  });

  return !!participant;
}

export async function isParticipant(sessionId: string, userId: string): Promise<boolean> {
  const participant = await prisma.participant.findFirst({
    where: { sessionId, userId, leftAt: null },
  });
  return !!participant;
}

/**
 * 게스트 ID 카운터 키 (Redis)
 */
const GUEST_COUNTER_KEY = 'guest:counter';

/**
 * 새 게스트 ID 생성 (@guest-nnnn 형식)
 */
export async function generateGuestId(): Promise<string> {
  const redis = getRedisClient();
  const counter = await redis.incr(GUEST_COUNTER_KEY);
  return `@guest-${counter}`;
}

/**
 * 게스트 사용자 생성
 */
export async function createGuestUser(guestId: string, displayName?: string): Promise<{
  id: string;
  email: string;
  name: string;
  isGuest: boolean;
}> {
  const name = displayName || guestId;
  const email = `${guestId}@guest.local`;
  const dummyPasswordHash = await bcrypt.hash(crypto.randomUUID(), BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: {
      email,
      passwordHash: dummyPasswordHash,
      name,
      isGuest: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isGuest: true,
    },
  });

  logger.info({ guestId, userId: user.id }, 'Guest user created');

  return user;
}

/**
 * 게스트로 세션 참가
 */
export async function joinSessionAsGuest(
  sessionId: string,
  guestUserId: string
): Promise<ParticipantInfo> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: { where: { leftAt: null } },
    },
  });

  if (!session) {
    throw new NotFoundError('Session');
  }

  if (session.status !== SessionStatus.ACTIVE) {
    throw new ConflictError('Session is not active');
  }

  if (!session.allowGuestMode) {
    throw new AuthorizationError('This session does not allow guest mode');
  }

  // 이미 활성 참가자인지 확인
  const existingActive = session.participants.find((p) => p.userId === guestUserId);
  if (existingActive) {
    const participant = await prisma.participant.findUnique({
      where: { id: existingActive.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return participant!;
  }

  // 이전에 떠난 참가자인지 확인
  const previousParticipant = await prisma.participant.findFirst({
    where: { sessionId, userId: guestUserId, leftAt: { not: null } },
  });

  if (previousParticipant) {
    // 재활성화
    const participant = await prisma.participant.update({
      where: { id: previousParticipant.id },
      data: { leftAt: null, role: ParticipantRole.GUEST },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    logger.info({ sessionId, guestUserId, participantId: participant.id, previousRole: previousParticipant.role }, 'Guest rejoined session as GUEST');
    return participant;
  }

  // 게스트 제한 확인
  const guestCount = session.participants.filter((p) => p.role === ParticipantRole.GUEST).length;
  if (guestCount >= session.maxGuests) {
    throw new ConflictError('Session is full');
  }

  const participant = await prisma.participant.create({
    data: {
      sessionId,
      userId: guestUserId,
      role: ParticipantRole.GUEST,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  logger.info({ sessionId, guestUserId, participantId: participant.id }, 'Guest joined session');

  return participant;
}

/**
 * 연결 끊긴 호스트 추적용 Redis 키 접두사
 */
const DISCONNECTED_HOST_KEY_PREFIX = 'session:disconnected_host:';

/**
 * 호스트의 연결 끊긴 세션 Redis 키 정리
 * 호스트가 새 세션을 생성할 때 호출됨
 */
async function clearDisconnectedSessionsForHost(hostId: string): Promise<void> {
  const redis = getRedisClient();

  // 사용자가 호스트인 활성 세션 찾기
  const sessions = await prisma.session.findMany({
    where: {
      OR: [
        { hostId },
        { participants: { some: { userId: hostId, role: ParticipantRole.HOST, leftAt: null } } },
      ],
      status: SessionStatus.ACTIVE,
    },
    select: { id: true },
  });

  // 해당 세션들의 disconnected 키 정리
  for (const session of sessions) {
    const key = `${DISCONNECTED_HOST_KEY_PREFIX}${session.id}`;
    const disconnectedInfo = await redis.hgetall(key);
    if (disconnectedInfo && disconnectedInfo.hostId === hostId) {
      await redis.del(key);
      logger.info({ sessionId: session.id, hostId }, 'Cleared disconnected host key (host created new session)');
    }
  }
}

/**
 * 호스트 여부 확인 (역할 또는 원래 호스트 ID)
 * 다중 호스트 지원
 */
export async function isHostByRole(sessionId: string, userId: string): Promise<boolean> {
  // 원래 호스트 ID 확인
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { hostId: true },
  });

  if (session?.hostId === userId) {
    return true;
  }

  // HOST 역할 확인
  const participant = await prisma.participant.findFirst({
    where: { sessionId, userId, leftAt: null, role: ParticipantRole.HOST },
  });

  return !!participant;
}

/**
 * 세션의 활성 참가자 수 조회
 */
export async function getActiveParticipantCount(sessionId: string): Promise<number> {
  return prisma.participant.count({
    where: { sessionId, leftAt: null },
  });
}

/**
 * 세션의 모든 활성 참가자 조회
 */
export async function getActiveParticipants(sessionId: string): Promise<ParticipantInfo[]> {
  const participants = await prisma.participant.findMany({
    where: { sessionId, leftAt: null },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return participants;
}

/**
 * 참가자 연결 끊김 처리
 * - 게스트 연결 끊김: 퇴장 처리
 * - 호스트 연결 끊김 & 다른 참가자 없음: 세션 종료
 * - 호스트 연결 끊김 & 공동 호스트 존재: 공동 호스트에게 권한 양도 (재접속 불가)
 * - 호스트 연결 끊김 & 다른 참가자 있음 (공동 호스트 없음): 재접속을 위해 연결 끊김 상태 저장
 * 반환값: { sessionClosed: boolean, hostDisconnected: boolean, newHostUserId?: string }
 */
export async function handleParticipantDisconnect(
  sessionId: string,
  userId: string
): Promise<{ sessionClosed: boolean; hostDisconnected: boolean; newHostUserId?: string }> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: { where: { leftAt: null } },
    },
  });

  if (!session || session.status === SessionStatus.CLOSED || session.status === SessionStatus.ARCHIVED) {
    return { sessionClosed: false, hostDisconnected: false };
  }

  const participant = session.participants.find((p) => p.userId === userId);
  if (!participant) {
    return { sessionClosed: false, hostDisconnected: false };
  }

  const isUserHost = participant.role === ParticipantRole.HOST || session.hostId === userId;
  const otherActiveParticipants = session.participants.filter((p) => p.userId !== userId);

  // Case A: 모든 참가자 연결 끊김 -> 세션 종료
  if (otherActiveParticipants.length === 0) {
    await prisma.$transaction([
      prisma.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.CLOSED, closedAt: new Date() },
      }),
      prisma.participant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() },
      }),
    ]);

    // Redis 캐시 제거
    const redis = getRedisClient();
    await redis.del(`session:${sessionId}`);
    await redis.del(`${DISCONNECTED_HOST_KEY_PREFIX}${sessionId}`);

    logger.info({ sessionId, userId }, 'Session closed - all participants disconnected');
    return { sessionClosed: true, hostDisconnected: false };
  }

  // Case B: 게스트 연결 끊김 -> 퇴장 처리
  if (!isUserHost) {
    // 호스트가 연결 끊긴 상태이고 다른 게스트도 없는지 확인
    const redis = getRedisClient();
    const disconnectedInfo = await redis.hgetall(`${DISCONNECTED_HOST_KEY_PREFIX}${sessionId}`);
    const hasDisconnectedHost = disconnectedInfo && Object.keys(disconnectedInfo).length > 0;

    // 이 게스트와 연결 끊긴 호스트를 제외한 나머지 활성 참가자
    const otherGuestsRemaining = otherActiveParticipants.filter(
      (p) => !(hasDisconnectedHost && p.userId === disconnectedInfo.hostId)
    );

    if (hasDisconnectedHost && otherGuestsRemaining.length === 0) {
      // 모든 게스트가 떠났고 호스트도 연결 끊김 -> 세션 종료
      const hostParticipant = session.participants.find((p) => p.userId === disconnectedInfo.hostId);
      const updates = [
        prisma.session.update({
          where: { id: sessionId },
          data: { status: SessionStatus.CLOSED, closedAt: new Date() },
        }),
        prisma.participant.update({
          where: { id: participant.id },
          data: { leftAt: new Date() },
        }),
      ];

      // 호스트도 퇴장 처리
      if (hostParticipant) {
        updates.push(
          prisma.participant.update({
            where: { id: hostParticipant.id },
            data: { leftAt: new Date() },
          })
        );
      }

      await prisma.$transaction(updates);

      // Redis 정리
      await redis.del(`session:${sessionId}`);
      await redis.del(`${DISCONNECTED_HOST_KEY_PREFIX}${sessionId}`);

      logger.info({ sessionId, userId }, 'Session closed - last guest left while host disconnected');
      return { sessionClosed: true, hostDisconnected: false };
    }

    // 일반적인 경우: 게스트 퇴장 처리
    await prisma.participant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });

    logger.info({ sessionId, userId }, 'Guest disconnected from session');
    return { sessionClosed: false, hostDisconnected: false };
  }

  // Case D: 호스트 연결 끊김 & 다른 참가자 유지
  // 공동 호스트 확인
  const coHost = otherActiveParticipants
    .filter((p) => p.role === ParticipantRole.HOST)
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];

  if (coHost) {
    // Case D-1: 공동 호스트 존재 -> 호스트 권한 이양, 재접속 불가
    await prisma.$transaction([
      // 원래 호스트 퇴장 처리
      prisma.participant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() },
      }),
      // 세션 호스트 ID 변경
      prisma.session.update({
        where: { id: sessionId },
        data: { hostId: coHost.userId },
      }),
    ]);

    logger.info(
      { sessionId, oldHostId: userId, newHostId: coHost.userId },
      'Host disconnected - transferred to co-host'
    );
    return { sessionClosed: false, hostDisconnected: false, newHostUserId: coHost.userId };
  }

  // Case D-2: No co-host -> save disconnected state for reconnection
  const redis = getRedisClient();
  await redis.hset(`${DISCONNECTED_HOST_KEY_PREFIX}${sessionId}`, {
    hostId: userId,
    disconnectedAt: Date.now().toString(),
  });
  // Expire after 1 hour
  await redis.expire(`${DISCONNECTED_HOST_KEY_PREFIX}${sessionId}`, 3600);

  logger.info({ sessionId, userId, remainingParticipants: otherActiveParticipants.length },
    'Host disconnected - session kept for reconnection');
  return { sessionClosed: false, hostDisconnected: true };
}

/**
 * Get disconnected session for a user (for reconnection prompt)
 * Returns the most recently disconnected session if user was a disconnected host
 */
export async function getDisconnectedHostSession(userId: string): Promise<{
  sessionId: string;
  sessionCode: string;
  participantCount: number;
  disconnectedAt: number;
} | null> {
  const redis = getRedisClient();

  // Find all active sessions where user is host
  const sessions = await prisma.session.findMany({
    where: {
      OR: [
        { hostId: userId },
        { participants: { some: { userId, role: ParticipantRole.HOST, leftAt: null } } },
      ],
      status: SessionStatus.ACTIVE,
    },
    include: {
      participants: { where: { leftAt: null } },
    },
  });

  // Find all disconnected sessions and return the most recent one
  let mostRecentSession: {
    sessionId: string;
    sessionCode: string;
    participantCount: number;
    disconnectedAt: number;
  } | null = null;

  for (const session of sessions) {
    const disconnectedInfo = await redis.hgetall(`${DISCONNECTED_HOST_KEY_PREFIX}${session.id}`);
    if (disconnectedInfo && disconnectedInfo.hostId === userId) {
      // Count only OTHER participants (excluding the disconnected host)
      const otherParticipants = session.participants.filter(p => p.userId !== userId);

      if (otherParticipants.length === 0) {
        // No other participants remaining - clean up and skip this session
        logger.info({ sessionId: session.id, userId },
          'Cleaning up disconnected session with no other participants');
        await redis.del(`${DISCONNECTED_HOST_KEY_PREFIX}${session.id}`);
        await redis.del(`session:${session.id}`);
        // Close the session in database
        await prisma.session.update({
          where: { id: session.id },
          data: { status: SessionStatus.CLOSED, closedAt: new Date() },
        });
        // Mark host as left
        const hostParticipant = session.participants.find(p => p.userId === userId);
        if (hostParticipant) {
          await prisma.participant.update({
            where: { id: hostParticipant.id },
            data: { leftAt: new Date() },
          });
        }
        continue;
      }

      const disconnectedAt = parseInt(disconnectedInfo.disconnectedAt, 10);
      if (!mostRecentSession || disconnectedAt > mostRecentSession.disconnectedAt) {
        mostRecentSession = {
          sessionId: session.id,
          sessionCode: session.code,
          participantCount: otherParticipants.length,
          disconnectedAt,
        };
      }
    }
  }

  return mostRecentSession;
}

/**
 * Reconnect host to session (API validation only, doesn't clear Redis state)
 */
export async function reconnectHostToSession(sessionId: string, userId: string): Promise<SessionWithParticipants | null> {
  const redis = getRedisClient();
  const disconnectedInfo = await redis.hgetall(`${DISCONNECTED_HOST_KEY_PREFIX}${sessionId}`);

  if (!disconnectedInfo || disconnectedInfo.hostId !== userId) {
    throw new AuthorizationError('Not authorized to reconnect to this session');
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      host: { select: { id: true, name: true, email: true } },
      participants: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!session || session.status !== SessionStatus.ACTIVE) {
    throw new NotFoundError('Session');
  }

  // Note: Redis state is NOT cleared here - it will be cleared when WebSocket connects
  logger.info({ sessionId, userId }, 'Host reconnection validated');

  return { ...session, hasPassword: !!session.passwordHash, inviteToken: session.inviteToken };
}

/**
 * Check if user was a disconnected host and clear ALL disconnected session states
 * Returns true if this was a reconnecting host
 */
export async function wasDisconnectedHost(sessionId: string, userId: string): Promise<boolean> {
  const redis = getRedisClient();
  const disconnectedInfo = await redis.hgetall(`${DISCONNECTED_HOST_KEY_PREFIX}${sessionId}`);

  if (disconnectedInfo && disconnectedInfo.hostId === userId) {
    // Clear ALL disconnected session keys for this host (not just this session)
    await clearDisconnectedSessionsForHost(userId);
    logger.info({ sessionId, userId }, 'Host reconnected via WebSocket - cleared all disconnected states');
    return true;
  }

  return false;
}

/**
 * Check which sessions have disconnected hosts
 * Returns a map of sessionId -> isHostDisconnected
 */
export async function getDisconnectedHostStatuses(sessionIds: string[]): Promise<Map<string, boolean>> {
  const redis = getRedisClient();
  const result = new Map<string, boolean>();

  await Promise.all(
    sessionIds.map(async (sessionId) => {
      const disconnectedInfo = await redis.hgetall(`${DISCONNECTED_HOST_KEY_PREFIX}${sessionId}`);
      const isDisconnected = disconnectedInfo && Object.keys(disconnectedInfo).length > 0;
      result.set(sessionId, !!isDisconnected);
    })
  );

  return result;
}

/**
 * Promote a participant to host
 * Only existing hosts can promote others
 */
export async function promoteToHost(
  sessionId: string,
  promoterId: string,
  targetUserId: string
): Promise<ParticipantInfo> {
  // Check if promoter is a host
  const isPromoterHost = await isHostByRole(sessionId, promoterId);
  if (!isPromoterHost) {
    throw new AuthorizationError('Only hosts can promote participants');
  }

  const participant = await prisma.participant.findFirst({
    where: { sessionId, userId: targetUserId, leftAt: null },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!participant) {
    throw new NotFoundError('Participant');
  }

  if (participant.role === ParticipantRole.HOST) {
    // Already a host
    return participant;
  }

  const updated = await prisma.participant.update({
    where: { id: participant.id },
    data: { role: ParticipantRole.HOST },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  logger.info({ sessionId, promoterId, targetUserId }, 'Participant promoted to host');

  return updated;
}

/**
 * Demote a host to guest
 * Only the original session host (hostId) can demote others
 */
export async function demoteToGuest(
  sessionId: string,
  demoterId: string,
  targetUserId: string
): Promise<ParticipantInfo> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { hostId: true },
  });

  if (!session) {
    throw new NotFoundError('Session');
  }

  // Only original host can demote
  if (session.hostId !== demoterId) {
    throw new AuthorizationError('Only the original host can demote participants');
  }

  // Cannot demote the original host
  if (targetUserId === session.hostId) {
    throw new AuthorizationError('Cannot demote the original host');
  }

  const participant = await prisma.participant.findFirst({
    where: { sessionId, userId: targetUserId, leftAt: null },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!participant) {
    throw new NotFoundError('Participant');
  }

  const updated = await prisma.participant.update({
    where: { id: participant.id },
    data: { role: ParticipantRole.GUEST },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  logger.info({ sessionId, demoterId, targetUserId }, 'Host demoted to guest');

  return updated;
}

/**
 * Kick a participant from the session (host only)
 */
export async function kickParticipant(
  sessionId: string,
  kickerId: string,
  targetUserId: string
): Promise<void> {
  const isKickerHost = await isHostByRole(sessionId, kickerId);
  if (!isKickerHost) {
    throw new AuthorizationError('Only hosts can kick participants');
  }

  // Cannot kick yourself
  if (kickerId === targetUserId) {
    throw new AuthorizationError('Cannot kick yourself');
  }

  const participant = await prisma.participant.findFirst({
    where: { sessionId, userId: targetUserId, leftAt: null },
  });

  if (!participant) {
    throw new NotFoundError('Participant');
  }

  // Cannot kick the original host
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { hostId: true },
  });
  if (session?.hostId === targetUserId) {
    throw new AuthorizationError('Cannot kick the original host');
  }

  await prisma.participant.update({
    where: { id: participant.id },
    data: { leftAt: new Date() },
  });

  logger.info({ sessionId, kickerId, targetUserId }, 'Participant kicked from session');
}

/**
 * 호스트가 생성한 세션 목록 조회 (최신순)
 */
export async function getHostSessions(hostId: string): Promise<Array<{
  id: string;
  code: string;
  title: string;
  status: SessionStatus;
  scheduledAt: Date | null;
  expectedParticipants: number | null;
  createdAt: Date;
  closedAt: Date | null;
  hasPassword: boolean;
  allowGuestMode: boolean;
  participantCount: number;
}>> {
  const sessions = await prisma.session.findMany({
    where: { hostId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { participants: true },
      },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    status: s.status,
    scheduledAt: s.scheduledAt,
    expectedParticipants: s.expectedParticipants,
    createdAt: s.createdAt,
    closedAt: s.closedAt,
    hasPassword: !!s.passwordHash,
    allowGuestMode: s.allowGuestMode,
    participantCount: s._count.participants,
  }));
}
