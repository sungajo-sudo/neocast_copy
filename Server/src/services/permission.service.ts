import { prisma } from '../db/index.js';
import { NotFoundError, AuthorizationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import * as sessionService from './session.service.js';

// 권한 정보 인터페이스
export interface PermissionInfo {
  id: string;
  sessionId: string;
  guestId: string;
  sourceId: string;
}

// 게스트별 권한 목록 (수신 가능한 소스 ID 목록)
export interface GuestPermissions {
  guestId: string;
  canReceiveFrom: string[];
}

/**
 * 게스트에게 특정 소스(참가자)의 스트로크 수신 권한 부여
 * 호스트만 수행할 수 있습니다.
 * @param sessionId 세션 ID
 * @param hostId 요청하는 호스트 ID
 * @param guestId 권한을 받을 게스트 ID
 * @param sourceId 스트로크 소스(대상) ID
 * @returns 생성된 권한 정보
 */
export async function grantPermission(
  sessionId: string,
  hostId: string,
  guestId: string,
  sourceId: string
): Promise<PermissionInfo> {
  // 호스트 검증
  const isHost = await sessionService.isHost(sessionId, hostId);
  if (!isHost) {
    throw new AuthorizationError('Only host can grant permissions');
  }

  // 게스트가 세션 참여자인지 확인
  const isGuestParticipant = await sessionService.isParticipant(sessionId, guestId);
  if (!isGuestParticipant) {
    throw new NotFoundError('Guest not in session');
  }

  // 소스가 세션 참여자인지 확인 (호스트일 수도 있음)
  const session = await sessionService.getSessionById(sessionId);
  if (!session) {
    throw new NotFoundError('Session');
  }

  const isSourceParticipant = await sessionService.isParticipant(sessionId, sourceId);
  if (!isSourceParticipant && sourceId !== hostId) {
    throw new NotFoundError('Source user not in session');
  }

  // 권한 생성 또는 업데이트 (Upsert)
  const permission = await prisma.permission.upsert({
    where: {
      sessionId_guestId_sourceId: {
        sessionId,
        guestId,
        sourceId,
      },
    },
    update: {},
    create: {
      sessionId,
      guestId,
      sourceId,
    },
  });

  logger.info({ sessionId, guestId, sourceId }, 'Permission granted');

  return permission;
}

/**
 * 게스트의 스트로크 수신 권한 회수
 * 호스트만 수행할 수 있습니다.
 * @param sessionId 세션 ID
 * @param hostId 호스트 ID
 * @param guestId 게스트 ID
 * @param sourceId 소스 ID
 */
export async function revokePermission(
  sessionId: string,
  hostId: string,
  guestId: string,
  sourceId: string
): Promise<void> {
  // 호스트 검증
  const isHost = await sessionService.isHost(sessionId, hostId);
  if (!isHost) {
    throw new AuthorizationError('Only host can revoke permissions');
  }

  await prisma.permission.deleteMany({
    where: { sessionId, guestId, sourceId },
  });

  logger.info({ sessionId, guestId, sourceId }, 'Permission revoked');
}

/**
 * 특정 게스트가 수신할 수 있는 소스 ID 목록 조회
 * @param sessionId 세션 ID
 * @param guestId 게스트 ID
 * @returns 소스 ID 배열
 */
export async function getPermissionsForGuest(sessionId: string, guestId: string): Promise<string[]> {
  const permissions = await prisma.permission.findMany({
    where: { sessionId, guestId },
    select: { sourceId: true },
  });

  return permissions.map((p) => p.sourceId);
}

/**
 * 세션의 모든 권한 목록 조회 (게스트별 그룹화)
 * @param sessionId 세션 ID
 * @returns 게스트별 권한 정보 목록
 */
export async function getSessionPermissions(sessionId: string): Promise<GuestPermissions[]> {
  const permissions = await prisma.permission.findMany({
    where: { sessionId },
  });

  // 게스트 ID로 그룹화
  const grouped = new Map<string, string[]>();
  for (const p of permissions) {
    const list = grouped.get(p.guestId) || [];
    list.push(p.sourceId);
    grouped.set(p.guestId, list);
  }

  return Array.from(grouped.entries()).map(([guestId, canReceiveFrom]) => ({
    guestId,
    canReceiveFrom,
  }));
}

/**
 * 수신자가 송신자의 스트로크를 받을 수 있는지 확인
 * @param sessionId 세션 ID
 * @param receiverId 수신자 ID (게스트 또는 호스트)
 * @param senderId 송신자 ID (게스트 또는 호스트)
 * @returns 수신 가능 여부
 */
export async function canReceiveFrom(sessionId: string, receiverId: string, senderId: string): Promise<boolean> {
  const session = await sessionService.getSessionById(sessionId);
  if (!session) {
    return false;
  }

  // 호스트는 모든 사람의 스트로크를 수신함
  if (session.hostId === receiverId) {
    return true;
  }

  // 게스트는 호스트의 스트로크를 항상 수신함
  if (senderId === session.hostId) {
    return true;
  }

  // 자신의 스트로크는 항상 수신 (Loopback)
  if (receiverId === senderId) {
    return true;
  }

  // 다른 게스트의 스트로크는 명시적인 권한이 있어야 수신 가능
  const permission = await prisma.permission.findUnique({
    where: {
      sessionId_guestId_sourceId: {
        sessionId,
        guestId: receiverId,
        sourceId: senderId,
      },
    },
  });

  return !!permission;
}

/**
 * 특정 송신자의 스트로크를 받아야 하는 수신자 목록 조회
 * 실시간 브로드캐스팅 시 대상을 필터링하기 위해 사용됩니다.
 * @param sessionId 세션 ID
 * @param senderId 송신자 ID
 * @returns 수신자 ID 배열
 */
export async function getReceiversForSender(sessionId: string, senderId: string): Promise<string[]> {
  const session = await sessionService.getSessionById(sessionId);
  if (!session) {
    return [];
  }

  // 호스트는 항상 수신자 목록에 포함
  const receivers = [session.hostId];

  // 송신자가 호스트인 경우, 모든 참가자에게 브로드캐스트 (기본적으로 게스트는 호스트 화면을 봄)
  if (senderId === session.hostId) {
    const participantIds = session.participants.map((p) => p.userId);
    receivers.push(...participantIds);
    return [...new Set(receivers)];
  }

  // 송신자가 게스트인 경우: 명시적 권한이 있는 게스트들을 찾음
  const permissions = await prisma.permission.findMany({
    where: { sessionId, sourceId: senderId },
    select: { guestId: true },
  });

  receivers.push(...permissions.map((p) => p.guestId));

  // 중복 제거 후 반환
  return [...new Set(receivers)];
}

/**
 * 세션의 모든 권한 삭제
 * 세션 종료 시 정리용
 */
export async function clearSessionPermissions(sessionId: string): Promise<void> {
  await prisma.permission.deleteMany({
    where: { sessionId },
  });

  logger.info({ sessionId }, 'All session permissions cleared');
}
