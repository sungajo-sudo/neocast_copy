import { SessionStatus } from '@prisma/client';
import { prisma } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, AuthorizationError } from '../utils/errors.js';
import * as strokeService from './stroke.service.js';
import zlib from 'zlib';
import { promisify } from 'util';

const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

// 아카이브 기본 정보 인터페이스
export interface ArchiveInfo {
  id: string;
  originalSessionId: string;
  hostId: string;
  totalStrokes: number;
  totalPages: number;
  duration: number;
  linkedPrevId: string | null;
  createdAt: Date;
}

// 데이터가 포함된 아카이브 정보
export interface ArchiveWithData extends ArchiveInfo {
  data: Buffer;
}

/**
 * 완료된 세션을 아카이브로 생성
 * 세션 정보, 참가자, 스트로크 데이터를 압축하여 저장합니다.
 * @param sessionId 세션 ID
 * @returns 생성된 아카이브 정보
 */
export async function createArchive(sessionId: string): Promise<ArchiveInfo> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      strokes: true,
      participants: true,
    },
  });

  if (!session) {
    throw new NotFoundError('Session');
  }

  // 세션이 종료된 상태여야 아카이브 가능
  if (session.status !== SessionStatus.CLOSED) {
    throw new Error('Session must be closed before archiving');
  }

  // 아카이브 지속 시간 계산
  const duration = session.closedAt
    ? Math.floor((session.closedAt.getTime() - session.createdAt.getTime()) / 1000)
    : 0;

  // 고유 페이지 수 계산 (section.owner.book.page 조합)
  const uniquePages = new Set(session.strokes.map((s) => `${s.section}.${s.owner}.${s.book}.${s.page}`));

  // 아카이브에 저장할 데이터 구성
  const archiveData = {
    session: {
      id: session.id,
      code: session.code,
      createdAt: session.createdAt.toISOString(),
      closedAt: session.closedAt?.toISOString(),
    },
    participants: session.participants.map((p) => ({
      userId: p.userId,
      role: p.role,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt?.toISOString(),
    })),
    strokes: session.strokes.map((s) => ({
      id: s.id,
      userId: s.userId,
      ownerUserId: s.ownerUserId,
      section: s.section,
      owner: s.owner,
      book: s.book,
      page: s.page,
      color: s.color,
      thickness: s.thickness,
      penType: s.penType,
      flags: s.flags,
      timestamp: s.timestamp.toString(),
      points: s.points.toString('base64'),
    })),
  };

  // 데이터 압축 (Deflate)
  const jsonData = JSON.stringify(archiveData);
  const compressedData = await deflate(Buffer.from(jsonData, 'utf-8'));

  // 아카이브 레코드 생성
  const archive = await prisma.archive.create({
    data: {
      originalSessionId: sessionId,
      hostId: session.hostId,
      totalStrokes: session.strokes.length,
      totalPages: uniquePages.size,
      duration,
      linkedPrevId: session.linkedArchiveId, // 이전 아카이브와 연결 (이어쓰기 정보)
      data: compressedData,
    },
  });

  // 세션 상태를 ARCHIVED로 업데이트
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: SessionStatus.ARCHIVED },
  });

  // 메모리에서 해당 세션의 스트로크 데이터 정리
  strokeService.clearSessionFromMemory(sessionId);

  logger.info(
    { archiveId: archive.id, sessionId, strokes: archive.totalStrokes, pages: archive.totalPages },
    'Archive created'
  );

  return archive;
}

/**
 * 아카이브 기본 정보 조회 (ID)
 */
export async function getArchiveById(archiveId: string): Promise<ArchiveInfo | null> {
  return prisma.archive.findUnique({
    where: { id: archiveId },
    select: {
      id: true,
      originalSessionId: true,
      hostId: true,
      totalStrokes: true,
      totalPages: true,
      duration: true,
      linkedPrevId: true,
      createdAt: true,
    },
  });
}

/**
 * 아카이브 전체 데이터 조회 (압축 데이터 포함)
 */
export async function getArchiveWithData(archiveId: string): Promise<ArchiveWithData | null> {
  return prisma.archive.findUnique({
    where: { id: archiveId },
  });
}

/**
 * 사용자의 아카이브 목록 조회
 * @param hostId 호스트 ID
 * @param limit 조회 개수 제한
 * @param offset 조회를 시작할 오프셋
 */
export async function listArchives(
  hostId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ArchiveInfo[]> {
  return prisma.archive.findMany({
    where: { hostId },
    select: {
      id: true,
      originalSessionId: true,
      hostId: true,
      totalStrokes: true,
      totalPages: true,
      duration: true,
      linkedPrevId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * 아카이브 데이터 압축 해제 및 반환
 * 클라이언트에서 재생(Replay) 등을 위해 사용합니다.
 */
export async function getArchiveData(archiveId: string): Promise<unknown> {
  const archive = await prisma.archive.findUnique({
    where: { id: archiveId },
    select: { data: true },
  });

  if (!archive) {
    throw new NotFoundError('Archive');
  }

  const decompressed = await inflate(archive.data);
  return JSON.parse(decompressed.toString('utf-8'));
}

/**
 * 아카이브 내용을 바탕으로 새 세션으로 복원 (이어쓰기 기능)
 * 아카이브의 스트로크를 새 세션에 복사합니다.
 */
export async function restoreFromArchive(
  archiveId: string,
  hostId: string
): Promise<{ sessionId: string; code: string }> {
  const archive = await prisma.archive.findUnique({
    where: { id: archiveId },
  });

  if (!archive) {
    throw new NotFoundError('Archive');
  }

  // 원래 호스트만 복원 가능
  if (archive.hostId !== hostId) {
    throw new AuthorizationError('Only original host can restore archive');
  }

  // 순환참조 방지를 위해 동적 import 사용
  const { createSession } = await import('./session.service.js');

  // 새 세션 생성 (아카이브와 연결)
  const session = await createSession(hostId, {
    linkedArchiveId: archiveId,
  });

  // 아카이브 데이터 압축 해제
  const decompressed = await inflate(archive.data);
  const archiveData = JSON.parse(decompressed.toString('utf-8')) as {
    strokes: Array<{
      id: string;
      userId: string;
      ownerUserId?: string; // 하위 호환성: 구 아카이브에는 없을 수 있음
      // New page address fields
      section?: number;
      owner?: number;
      book?: number;
      page?: number;
      // Legacy field (deprecated)
      pageId?: number;
      color: number;
      thickness: number;
      penType: number;
      flags: number;
      timestamp: string;
      points: string;
    }>;
  };

  // 스트로크 데이터를 새 세션에 복제
  if (archiveData.strokes && archiveData.strokes.length > 0) {
    await prisma.stroke.createMany({
      data: archiveData.strokes.map((s) => ({
        sessionId: session.id,
        userId: s.userId,
        ownerUserId: s.ownerUserId ?? s.userId, // 하위 호환성: ownerUserId가 없으면 userId 사용
        // 새 필드 확인, 없으면 레거시 로직 사용
        section: s.section ?? 1024, // 기본값: 마우스 입력 섹션
        owner: s.owner ?? 1,
        book: s.book ?? 1,
        page: s.page ?? (s.pageId ?? 1), // 새 필드가 없으면 기존 pageId 사용
        color: s.color,
        thickness: s.thickness,
        penType: s.penType,
        flags: s.flags,
        timestamp: BigInt(s.timestamp),
        points: Buffer.from(s.points, 'base64'),
      })),
    });
  }

  logger.info(
    { archiveId, newSessionId: session.id, strokes: archiveData.strokes?.length || 0 },
    'Session restored from archive'
  );

  return { sessionId: session.id, code: session.code };
}

/**
 * 아카이브 삭제
 * 소유자만 삭제할 수 있습니다.
 */
export async function deleteArchive(archiveId: string, userId: string): Promise<void> {
  const archive = await prisma.archive.findUnique({
    where: { id: archiveId },
    select: { hostId: true },
  });

  if (!archive) {
    throw new NotFoundError('Archive');
  }

  if (archive.hostId !== userId) {
    throw new AuthorizationError('Only owner can delete archive');
  }

  await prisma.archive.delete({
    where: { id: archiveId },
  });

  logger.info({ archiveId, userId }, 'Archive deleted');
}

/**
 * 연결된 아카이브 체인 조회 (가장 오래된 것부터 최신 순으로)
 * 이어쓰기로 연결된 모든 아카이브를 찾아 반환합니다.
 */
export async function getLinkedArchives(archiveId: string): Promise<ArchiveInfo[]> {
  const archives: ArchiveInfo[] = [];
  let currentId: string | null = archiveId;

  while (currentId) {
    const archive = await getArchiveById(currentId);
    if (!archive) break;

    archives.unshift(archive); // 리스트에 앞에 추가 (오래된 순서대로 정렬)
    currentId = archive.linkedPrevId;
  }

  return archives;
}

/**
 * 전체 아카이브 개수 조회 (관리자용)
 */
export async function getArchiveCount(): Promise<number> {
  return prisma.archive.count();
}
