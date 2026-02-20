import { prisma } from '../db/index.js';
import { logger } from '../utils/logger.js';

export interface SessionChatMessageInfo {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  content: string;
  type: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * 세션 채팅 메시지 저장
 */
export async function saveMessage(
  sessionId: string,
  userId: string,
  userName: string,
  content: string,
  type: string = 'message',
  metadata?: Record<string, unknown>
): Promise<SessionChatMessageInfo> {
  const message = await prisma.sessionChatMessage.create({
    data: {
      sessionId,
      userId,
      userName,
      content,
      type,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  logger.debug({ sessionId, userId, messageId: message.id, type }, 'Session chat message saved');

  return {
    id: message.id,
    sessionId: message.sessionId,
    userId: message.userId,
    userName: message.userName,
    content: message.content,
    type: message.type,
    metadata: message.metadata ? JSON.parse(message.metadata) : undefined,
    createdAt: message.createdAt,
  };
}

/**
 * 세션 채팅 히스토리 조회
 */
export async function getMessages(
  sessionId: string,
  options?: { limit?: number; before?: string }
): Promise<{ messages: SessionChatMessageInfo[]; hasMore: boolean }> {
  const limit = options?.limit ?? 100;

  let cursor: { id: string } | undefined;
  if (options?.before) {
    cursor = { id: options.before };
  }

  const messages = await prisma.sessionChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor,
      skip: 1,
    }),
  });

  const hasMore = messages.length > limit;
  if (hasMore) {
    messages.pop();
  }

  // Reverse to get chronological order
  messages.reverse();

  return {
    messages: messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      userId: m.userId,
      userName: m.userName,
      content: m.content,
      type: m.type,
      metadata: m.metadata ? JSON.parse(m.metadata) : undefined,
      createdAt: m.createdAt,
    })),
    hasMore,
  };
}

/**
 * 세션의 채팅 메시지 수 조회
 */
export async function getMessageCount(sessionId: string): Promise<number> {
  return prisma.sessionChatMessage.count({
    where: { sessionId },
  });
}

/**
 * 세션 채팅 메시지 삭제 (세션 종료 시)
 * 참고: onDelete: Cascade로 설정되어 세션 삭제 시 자동 삭제됨
 */
export async function deleteMessages(sessionId: string): Promise<number> {
  const result = await prisma.sessionChatMessage.deleteMany({
    where: { sessionId },
  });

  logger.info({ sessionId, deletedCount: result.count }, 'Session chat messages deleted');
  return result.count;
}

/**
 * 사용자가 참여했던 세션 채팅 목록 조회 (메신저용)
 * 최근 메시지가 있는 세션만 반환
 */
export async function getUserSessionChats(userId: string): Promise<{
  sessionId: string;
  sessionCode: string;
  hostName: string;
  lastMessage: string;
  lastMessageAt: Date;
  messageCount: number;
  participantNames: string[];
}[]> {
  // 사용자가 참여한 세션 중 채팅 메시지가 있는 것만 조회
  const participants = await prisma.participant.findMany({
    where: { userId },
    include: {
      session: {
        include: {
          host: { select: { name: true } },
          participants: {
            include: {
              user: { select: { name: true } },
            },
          },
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: { chatMessages: true },
          },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  // 채팅 메시지가 있는 세션만 필터링
  const sessionsWithChats = participants
    .filter((p) => p.session._count.chatMessages > 0)
    .map((p) => ({
      sessionId: p.session.id,
      sessionCode: p.session.code,
      hostName: p.session.host.name,
      lastMessage: p.session.chatMessages[0]?.content ?? '',
      lastMessageAt: p.session.chatMessages[0]?.createdAt ?? p.session.createdAt,
      messageCount: p.session._count.chatMessages,
      participantNames: p.session.participants.map((part) => part.user.name),
    }))
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

  return sessionsWithChats;
}
