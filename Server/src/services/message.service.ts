import { prisma } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { NotFoundError } from '../utils/errors.js';

export interface ThreadInfo {
  id: string;
  participantId: string;
  participantEmail: string;
  participantName: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  createdAt: Date;
}

export interface MessageInfo {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  metadata?: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * 두 사용자 간 대화 스레드 가져오기 또는 생성
 */
export async function getOrCreateThread(userId1: string, userId2: string): Promise<string> {
  // 항상 작은 ID를 participant1으로 사용하여 일관성 유지
  const [participant1, participant2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

  let thread = await prisma.directMessageThread.findUnique({
    where: {
      participant1_participant2: { participant1, participant2 },
    },
  });

  if (!thread) {
    thread = await prisma.directMessageThread.create({
      data: { participant1, participant2 },
    });
    logger.info({ threadId: thread.id, participant1, participant2 }, 'DM thread created');
  }

  return thread.id;
}

/**
 * 사용자의 대화 목록 조회
 */
export async function getThreads(userId: string): Promise<ThreadInfo[]> {
  const threads = await prisma.directMessageThread.findMany({
    where: {
      OR: [{ participant1: userId }, { participant2: userId }],
    },
    include: {
      user1: { select: { id: true, email: true, name: true } },
      user2: { select: { id: true, email: true, name: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          content: true,
          createdAt: true,
        },
      },
    },
    orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
  });

  // 읽지 않은 메시지 수 계산을 위한 별도 쿼리
  const unreadCounts = await prisma.directMessage.groupBy({
    by: ['threadId'],
    where: {
      thread: {
        OR: [{ participant1: userId }, { participant2: userId }],
      },
      senderId: { not: userId },
      readAt: null,
    },
    _count: true,
  });

  const unreadMap = new Map<string, number>();
  unreadCounts.forEach((item) => {
    unreadMap.set(item.threadId, item._count);
  });

  return threads.map((t) => {
    const otherUser = t.participant1 === userId ? t.user2 : t.user1;
    const lastMessage = t.messages[0] || null;

    return {
      id: t.id,
      participantId: otherUser.id,
      participantEmail: otherUser.email,
      participantName: otherUser.name,
      lastMessage: lastMessage?.content ?? null,
      lastMessageAt: t.lastMessageAt,
      unreadCount: unreadMap.get(t.id) ?? 0,
      createdAt: t.createdAt,
    };
  });
}

/**
 * 특정 대화의 메시지 목록 조회 (페이지네이션)
 */
export async function getMessages(
  threadId: string,
  userId: string,
  options: { limit?: number; before?: string } = {}
): Promise<{ messages: MessageInfo[]; hasMore: boolean }> {
  const { limit = 50, before } = options;

  // 스레드 접근 권한 확인
  const thread = await prisma.directMessageThread.findUnique({
    where: { id: threadId },
  });

  if (!thread || (thread.participant1 !== userId && thread.participant2 !== userId)) {
    throw new NotFoundError('Thread not found');
  }

  const whereClause: Record<string, unknown> = { threadId };

  if (before) {
    const beforeMessage = await prisma.directMessage.findUnique({
      where: { id: before },
      select: { createdAt: true },
    });
    if (beforeMessage) {
      whereClause.createdAt = { lt: beforeMessage.createdAt };
    }
  }

  const messages = await prisma.directMessage.findMany({
    where: whereClause,
    include: {
      sender: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // 하나 더 가져와서 hasMore 판단
  });

  const hasMore = messages.length > limit;
  if (hasMore) {
    messages.pop();
  }

  // 오래된 순으로 정렬
  messages.reverse();

  return {
    messages: messages.map((m) => ({
      id: m.id,
      threadId: m.threadId,
      senderId: m.sender.id,
      senderName: m.sender.name,
      content: m.content,
      metadata: m.metadata,
      readAt: m.readAt,
      createdAt: m.createdAt,
    })),
    hasMore,
  };
}

/**
 * 메시지 전송
 */
export async function sendMessage(threadId: string, senderId: string, content: string, metadata?: string): Promise<MessageInfo> {
  // 스레드 접근 권한 확인
  const thread = await prisma.directMessageThread.findUnique({
    where: { id: threadId },
  });

  if (!thread || (thread.participant1 !== senderId && thread.participant2 !== senderId)) {
    throw new NotFoundError('Thread not found');
  }

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { name: true },
  });

  const message = await prisma.directMessage.create({
    data: {
      threadId,
      senderId,
      content,
      ...(metadata ? { metadata } : {}),
    },
  });

  // 스레드의 lastMessageAt 업데이트
  await prisma.directMessageThread.update({
    where: { id: threadId },
    data: { lastMessageAt: message.createdAt },
  });

  logger.debug({ threadId, senderId, messageId: message.id }, 'DM sent');

  return {
    id: message.id,
    threadId: message.threadId,
    senderId: message.senderId,
    senderName: sender!.name,
    content: message.content,
    metadata: message.metadata,
    readAt: message.readAt,
    createdAt: message.createdAt,
  };
}

/**
 * 대화 읽음 처리
 */
export async function markThreadAsRead(threadId: string, userId: string): Promise<number> {
  // 스레드 접근 권한 확인
  const thread = await prisma.directMessageThread.findUnique({
    where: { id: threadId },
  });

  if (!thread || (thread.participant1 !== userId && thread.participant2 !== userId)) {
    throw new NotFoundError('Thread not found');
  }

  // 상대방이 보낸 읽지 않은 메시지만 읽음 처리
  const result = await prisma.directMessage.updateMany({
    where: {
      threadId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  logger.debug({ threadId, userId, count: result.count }, 'Messages marked as read');

  return result.count;
}

/**
 * 전체 읽지 않은 메시지 수 조회
 */
export async function getTotalUnreadCount(userId: string): Promise<number> {
  const count = await prisma.directMessage.count({
    where: {
      thread: {
        OR: [{ participant1: userId }, { participant2: userId }],
      },
      senderId: { not: userId },
      readAt: null,
    },
  });

  return count;
}

/**
 * 특정 사용자와의 스레드 ID 가져오기
 */
export async function getThreadIdWithUser(userId: string, otherUserId: string): Promise<string | null> {
  const [participant1, participant2] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

  const thread = await prisma.directMessageThread.findUnique({
    where: {
      participant1_participant2: { participant1, participant2 },
    },
  });

  return thread?.id ?? null;
}
