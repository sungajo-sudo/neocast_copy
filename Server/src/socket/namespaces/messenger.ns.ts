import { Namespace } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/auth.js';
import { getUserRoom } from '../index.js';
import { logger } from '../../utils/logger.js';
import * as messageService from '../../services/message.service.js';
import * as presenceService from '../../services/presence.service.js';
import * as friendService from '../../services/friend.service.js';

// 타이핑 인디케이터 타입
interface TypingData {
  threadId: string;
}

// DM 전송 데이터 타입
interface SendDmData {
  threadId: string;
  content: string;
  metadata?: string;
}

// DM 전송 (친구에게 직접) 데이터 타입
interface SendDmToFriendData {
  friendId: string;
  content: string;
  metadata?: string;
}

// 메신저 네임스페이스 - DM 및 프레즌스 관리
export function setupMessengerNamespace(namespace: Namespace): void {
  namespace.on('connection', async (rawSocket) => {
    const socket = rawSocket as unknown as AuthenticatedSocket;
    const userId = socket.user.userId;

    logger.info({ socketId: socket.id, userId }, 'Messenger namespace connection');

    // 사용자 개인 룸에 조인
    socket.join(getUserRoom(userId));

    // 온라인 상태 설정
    await presenceService.setOnline(userId);

    // 친구들에게 온라인 알림
    await notifyFriendsOfStatusChange(namespace, userId, 'online');

    // 친구 목록과 함께 초기 상태 전송
    const friends = await friendService.getFriends(userId);
    const friendIds = friends.map((f) => f.friendId);
    const presenceMap = await presenceService.getPresenceBulk(friendIds);

    const friendsWithStatus = friends.map((f) => ({
      friendId: f.friendId,
      name: f.name,
      status: presenceMap.get(f.friendId)?.status ?? 'offline',
    }));

    socket.emit('messenger:ready', {
      friends: friendsWithStatus,
    });

    // DM 전송 (스레드 ID 기반)
    socket.on('dm:send', async (data: SendDmData) => {
      if (!data.threadId) return;
      // content가 비어있어도 metadata가 있으면 허용 (파일 첨부)
      if (!data.content?.trim() && !data.metadata) return;

      try {
        const message = await messageService.sendMessage(data.threadId, userId, data.content?.trim() || '', data.metadata);

        // 스레드의 다른 참가자 찾기
        const threads = await messageService.getThreads(userId);
        const thread = threads.find((t) => t.id === data.threadId);

        if (thread) {
          // 수신자에게 전송
          namespace.to(getUserRoom(thread.participantId)).emit('dm:message', message);
          // 발신자에게 확인
          socket.emit('dm:sent', message);

          logger.debug({ threadId: data.threadId, from: userId, to: thread.participantId }, 'DM sent via socket');
        }
      } catch (error) {
        logger.error({ error, userId, threadId: data.threadId }, 'Failed to send DM');
        socket.emit('dm:error', { code: 'SEND_FAILED', message: 'Failed to send message' });
      }
    });

    // DM 전송 (친구 ID 기반 - 스레드 자동 생성)
    socket.on('dm:sendToFriend', async (data: SendDmToFriendData) => {
      if (!data.friendId) return;
      if (!data.content?.trim() && !data.metadata) return;

      try {
        // 스레드 가져오기 또는 생성
        const threadId = await messageService.getOrCreateThread(userId, data.friendId);
        const message = await messageService.sendMessage(threadId, userId, data.content?.trim() || '', data.metadata);

        // 수신자에게 전송
        namespace.to(getUserRoom(data.friendId)).emit('dm:message', message);
        // 발신자에게 확인
        socket.emit('dm:sent', message);

        logger.debug({ threadId, from: userId, to: data.friendId }, 'DM sent to friend via socket');
      } catch (error) {
        logger.error({ error, userId, friendId: data.friendId }, 'Failed to send DM to friend');
        socket.emit('dm:error', { code: 'SEND_FAILED', message: 'Failed to send message' });
      }
    });

    // 타이핑 인디케이터
    socket.on('dm:typing', async (data: TypingData & { isTyping: boolean }) => {
      if (!data.threadId) return;

      try {
        const threads = await messageService.getThreads(userId);
        const thread = threads.find((t) => t.id === data.threadId);

        if (thread) {
          namespace.to(getUserRoom(thread.participantId)).emit('dm:typing', {
            threadId: data.threadId,
            userId,
            isTyping: data.isTyping,
          });
        }
      } catch (error) {
        logger.error({ error, userId }, 'Failed to send typing indicator');
      }
    });

    // 메시지 읽음 처리
    socket.on('dm:markRead', async (data: { threadId: string }) => {
      if (!data.threadId) return;

      try {
        await messageService.markThreadAsRead(data.threadId, userId);

        // 상대방에게 읽음 알림 (선택적)
        const threads = await messageService.getThreads(userId);
        const thread = threads.find((t) => t.id === data.threadId);

        if (thread) {
          namespace.to(getUserRoom(thread.participantId)).emit('dm:read', {
            threadId: data.threadId,
            readBy: userId,
            readAt: new Date().toISOString(),
          });
        }

        socket.emit('dm:readConfirm', { threadId: data.threadId });
      } catch (error) {
        logger.error({ error, userId, threadId: data.threadId }, 'Failed to mark as read');
      }
    });

    // 프레즌스 하트비트
    socket.on('presence:heartbeat', async () => {
      await presenceService.heartbeat(userId);
    });

    // 상태 변경 (busy, away)
    socket.on('presence:setStatus', async (data: { status: 'online' | 'busy' | 'away' }) => {
      switch (data.status) {
        case 'busy':
          await presenceService.setBusy(userId);
          break;
        case 'away':
          await presenceService.setAway(userId);
          break;
        default:
          await presenceService.setOnline(userId);
      }

      await notifyFriendsOfStatusChange(namespace, userId, data.status);
    });

    // 연결 해제
    socket.on('disconnect', async (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'Messenger namespace disconnection');

      // 다른 연결이 있는지 확인
      const sockets = await namespace.in(getUserRoom(userId)).fetchSockets();

      // 이 사용자의 다른 소켓이 없으면 오프라인으로 설정
      if (sockets.length === 0) {
        await presenceService.setOffline(userId);
        await notifyFriendsOfStatusChange(namespace, userId, 'offline');
      }
    });

    socket.on('error', (error) => {
      logger.error({ socketId: socket.id, error }, 'Socket error in messenger namespace');
    });
  });
}

/**
 * 친구들에게 상태 변경 알림
 */
async function notifyFriendsOfStatusChange(
  namespace: Namespace,
  userId: string,
  status: presenceService.PresenceStatus
): Promise<void> {
  try {
    const friends = await friendService.getFriends(userId);

    for (const friend of friends) {
      namespace.to(getUserRoom(friend.friendId)).emit('friend:status', {
        userId,
        status,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    logger.error({ error, userId }, 'Failed to notify friends of status change');
  }
}
