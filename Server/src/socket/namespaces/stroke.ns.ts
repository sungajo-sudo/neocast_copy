import { Namespace } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/auth.js';
import { getSessionRoom, getUserRoom } from '../index.js';
import { logger } from '../../utils/logger.js';
import { parseClientMessage, buildWrappedMessage, buildErrorMessage } from '../../protocol/messages.js';
import { ProtocolErrorCode } from '../../protocol/types.js';
import * as sessionService from '../../services/session.service.js';
import * as permissionService from '../../services/permission.service.js';
import * as strokeService from '../../services/stroke.service.js';

export function setupStrokeNamespace(namespace: Namespace): void {
  namespace.on('connection', async (rawSocket) => {
    const socket = rawSocket as unknown as AuthenticatedSocket;
    const userId = socket.user.userId;
    const sessionId = socket.handshake.query.sessionId as string;

    logger.info({ socketId: socket.id, userId, sessionId }, 'Stroke namespace connection');

    if (!sessionId) {
      socket.emit('error', buildErrorMessage(ProtocolErrorCode.SESSION_NOT_FOUND, 'Session ID required'));
      socket.disconnect();
      return;
    }

    // Verify user is participant
    const isParticipant = await sessionService.isParticipant(sessionId, userId);
    if (!isParticipant) {
      socket.emit('error', buildErrorMessage(ProtocolErrorCode.PERMISSION_DENIED, 'Not a participant'));
      socket.disconnect();
      return;
    }

    // Join session room and user room
    socket.join(getSessionRoom(sessionId));
    socket.join(getUserRoom(userId));
    socket.sessionId = sessionId;

    // Send history to late joiner
    await sendHistoryToSocket(socket, sessionId);

    // Handle binary stroke data
    socket.on('stroke', async (data: Buffer) => {
      try {
        const message = parseClientMessage(data);

        logger.info(
          { socketId: socket.id, userId, sessionId, messageType: message.type, dataLength: data.length },
          'Received stroke message'
        );

        // Process and store stroke data
        await strokeService.processStrokeMessage(sessionId, userId, message, data);

        // Get receivers for this sender
        const receivers = await permissionService.getReceiversForSender(sessionId, userId);

        // logger.info(
        //   { socketId: socket.id, userId, sessionId, receivers },
        //   'Broadcasting to receivers'
        // );

        // Wrap and broadcast to receivers
        const wrappedData = buildWrappedMessage(userId, data);
        for (const receiverId of receivers) {
          if (receiverId !== userId) {
            // logger.info(
            //   { socketId: socket.id, senderId: userId, receiverId, room: getUserRoom(receiverId) },
            //   'Emitting stroke to receiver'
            // );
            namespace.to(getUserRoom(receiverId)).emit('stroke', wrappedData);
          }
        }

        logger.debug(
          { socketId: socket.id, messageType: message.type, receivers: receivers.length },
          'Stroke message processed'
        );
      } catch (error) {
        logger.error({ socketId: socket.id, error }, 'Error processing stroke message');
        socket.emit('error', buildErrorMessage(ProtocolErrorCode.INVALID_PACKET, 'Invalid packet format'));
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId, sessionId, reason }, 'Stroke namespace disconnection');
    });

    socket.on('error', (error) => {
      logger.error({ socketId: socket.id, error }, 'Socket error in stroke namespace');
    });
  });
}

async function sendHistoryToSocket(socket: AuthenticatedSocket, sessionId: string): Promise<void> {
  try {
    const userId = socket.user.userId;
    const canReceive = await getHistorySourcesForUser(sessionId, userId);

    logger.info(
      { socketId: socket.id, userId, sessionId, canReceiveFrom: canReceive },
      'Preparing to send history to client'
    );

    if (canReceive.length === 0) {
      logger.info({ socketId: socket.id, userId, sessionId }, 'No sources to receive history from');
      return;
    }

    await strokeService.sendHistoryToSocket(socket, sessionId, canReceive);
  } catch (error) {
    logger.error({ socketId: socket.id, sessionId, error }, 'Error sending history');
  }
}

async function getHistorySourcesForUser(sessionId: string, userId: string): Promise<string[]> {
  const session = await sessionService.getSessionById(sessionId);
  if (!session) return [];

  // Host can receive from everyone
  if (session.hostId === userId) {
    return session.participants.map((p) => p.userId);
  }

  // Guest can receive from:
  // 1. Host (always, by default)
  // 2. Self (their own strokes)
  // 3. Explicitly permitted sources
  const sources = [session.hostId, userId];
  const permissions = await permissionService.getPermissionsForGuest(sessionId, userId);
  sources.push(...permissions);

  return [...new Set(sources)];
}
