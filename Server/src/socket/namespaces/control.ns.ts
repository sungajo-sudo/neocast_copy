import { Namespace } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/auth.js';
import { getSessionRoom, getUserRoom } from '../index.js';
import { logger } from '../../utils/logger.js';
import { ControlEventType, type SessionStatusValue, type LeaveReason, type ParticipantRoleValue } from '../../protocol/types.js';
import * as sessionService from '../../services/session.service.js';

// Control message interfaces
interface SessionStatusMessage {
  type: typeof ControlEventType.SESSION_STATUS;
  status: SessionStatusValue;
  timestamp: number;
}

interface ParticipantJoinMessage {
  type: typeof ControlEventType.PARTICIPANT_JOIN;
  userId: string;
  userName: string;
  role: ParticipantRoleValue;
  timestamp: number;
}

interface ParticipantLeaveMessage {
  type: typeof ControlEventType.PARTICIPANT_LEAVE;
  userId: string;
  reason: LeaveReason;
  timestamp: number;
}

interface PermissionChangedMessage {
  type: typeof ControlEventType.PERMISSION_CHANGED;
  guestId: string;
  canReceiveFrom: string[];
  timestamp: number;
}

interface SpotlightShareMessage {
  type: typeof ControlEventType.SPOTLIGHT_SHARE;
  userId: string | null;
  timestamp: number;
}

type ControlMessage =
  | SessionStatusMessage
  | ParticipantJoinMessage
  | ParticipantLeaveMessage
  | PermissionChangedMessage
  | SpotlightShareMessage;

export function setupControlNamespace(namespace: Namespace): void {
  namespace.on('connection', async (rawSocket) => {
    const socket = rawSocket as unknown as AuthenticatedSocket;
    const userId = socket.user.userId;
    const sessionId = socket.handshake.query.sessionId as string;

    logger.info({ socketId: socket.id, userId, sessionId }, 'Control namespace connection');

    if (!sessionId) {
      logger.warn({ socketId: socket.id, userId }, 'Control namespace connection without sessionId - waiting for reconnect with sessionId');
      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id, userId, reason: 'no-session' }, 'Control socket without sessionId disconnected');
      });
      return;
    }

    // Verify user is participant
    const isParticipant = await sessionService.isParticipant(sessionId, userId);
    if (!isParticipant) {
      socket.emit('error', { code: 'PERMISSION_DENIED', message: 'Not a participant' });
      socket.disconnect();
      return;
    }

    // Join session room and user room
    socket.join(getSessionRoom(sessionId));
    socket.join(getUserRoom(userId));
    socket.sessionId = sessionId;

    // Check if this is a reconnecting host
    const isReconnectingHost = await sessionService.wasDisconnectedHost(sessionId, userId);

    // Get session info and notify others of join
    const session = await sessionService.getSessionById(sessionId);
    if (session) {
      const participant = session.participants.find((p) => p.userId === userId);
      if (participant) {
        const roomName = getSessionRoom(sessionId);

        // Send existing participant list to the newly connected socket
        const existingParticipants = session.participants
          .filter((p) => p.userId !== userId && !p.leftAt)
          .map((p) => ({
            type: ControlEventType.PARTICIPANT_JOIN,
            userId: p.userId,
            userName: p.user.name,
            role: p.role.toLowerCase() as ParticipantRoleValue,
            timestamp: p.joinedAt.getTime(),
          }));

        if (existingParticipants.length > 0) {
          logger.info({ sessionId, userId, count: existingParticipants.length }, 'Sending existing participants to new socket');
          for (const msg of existingParticipants) {
            socket.emit('control', msg);
          }
        }

        if (isReconnectingHost) {
          // Send HOST_RECONNECTED for reconnecting hosts
          const reconnectMessage = {
            type: 'HOST_RECONNECTED' as const,
            userId,
            userName: participant.user.name,
            timestamp: Date.now(),
          };
          logger.info({ sessionId, userId, userName: participant.user.name, roomName }, 'Broadcasting HOST_RECONNECTED');
          socket.to(roomName).emit('control', reconnectMessage);
        } else {
          // Send PARTICIPANT_JOIN for new participants
          const joinMessage: ParticipantJoinMessage = {
            type: ControlEventType.PARTICIPANT_JOIN,
            userId,
            userName: participant.user.name,
            role: participant.role.toLowerCase() as ParticipantRoleValue,
            timestamp: Date.now(),
          };
          logger.info({ sessionId, userId, userName: participant.user.name, roomName }, 'Broadcasting PARTICIPANT_JOIN');
          socket.to(roomName).emit('control', joinMessage);
        }
      } else {
        logger.warn({ sessionId, userId, participantCount: session.participants.length }, 'Participant not found in session for join broadcast');
      }
    } else {
      logger.warn({ sessionId, userId }, 'Session not found for join broadcast');
    }

    // Handle control messages from client
    socket.on('control', async (message: ControlMessage) => {
      try {
        await handleControlMessage(namespace, socket, sessionId, userId, message);
      } catch (error) {
        logger.error({ socketId: socket.id, message, error }, 'Error handling control message');
        socket.emit('error', { code: 'INTERNAL_ERROR', message: 'Failed to process message' });
      }
    });

    socket.on('disconnect', async (reason) => {
      logger.info({ socketId: socket.id, userId, sessionId, reason }, 'Control namespace disconnection');

      // Determine leave reason
      const leaveReason: LeaveReason = reason === 'client namespace disconnect' ? 'left' : 'disconnect';

      // Handle disconnect in database
      try {
        const result = await sessionService.handleParticipantDisconnect(sessionId, userId);

        // Case 1: Host transferred to co-host
        if (result.newHostUserId) {
          // Send HOST_CHANGED event to notify all clients about new host
          const hostChangedMessage = {
            type: 'HOST_CHANGED' as const,
            oldHostId: userId,
            newHostId: result.newHostUserId,
            timestamp: Date.now(),
          };
          socket.to(getSessionRoom(sessionId)).emit('control', hostChangedMessage);
          logger.info({ sessionId, oldHostId: userId, newHostId: result.newHostUserId }, 'Host transferred to co-host - sent HOST_CHANGED');

          // Also send PARTICIPANT_LEAVE for the old host
          const leaveMessage: ParticipantLeaveMessage = {
            type: ControlEventType.PARTICIPANT_LEAVE,
            userId,
            reason: leaveReason,
            timestamp: Date.now(),
          };
          socket.to(getSessionRoom(sessionId)).emit('control', leaveMessage);
        }
        // Case 2: Host disconnected (but session is still active), send HOST_DISCONNECTED
        // This allows the host to reconnect without being removed from the participant list
        else if (result.hostDisconnected) {
          const hostDisconnectedMessage = {
            type: 'HOST_DISCONNECTED' as const,
            hostId: userId,
            timestamp: Date.now(),
          };
          socket.to(getSessionRoom(sessionId)).emit('control', hostDisconnectedMessage);
          logger.info({ sessionId, userId }, 'Host disconnected - sent HOST_DISCONNECTED');
        }
        // Case 3: Normal participant leave
        else if (!result.sessionClosed) {
          const leaveMessage: ParticipantLeaveMessage = {
            type: ControlEventType.PARTICIPANT_LEAVE,
            userId,
            reason: leaveReason,
            timestamp: Date.now(),
          };
          socket.to(getSessionRoom(sessionId)).emit('control', leaveMessage);
        }

        // If session was closed, notify all remaining sockets
        if (result.sessionClosed) {
          const statusMessage: SessionStatusMessage = {
            type: ControlEventType.SESSION_STATUS,
            status: 'closed',
            timestamp: Date.now(),
          };
          namespace.to(getSessionRoom(sessionId)).emit('control', statusMessage);
        }
      } catch (error) {
        logger.error({ socketId: socket.id, userId, sessionId, error }, 'Error handling disconnect');
      }
    });

    socket.on('error', (error) => {
      logger.error({ socketId: socket.id, error }, 'Socket error in control namespace');
    });
  });
}

async function handleControlMessage(
  namespace: Namespace,
  socket: AuthenticatedSocket,
  sessionId: string,
  userId: string,
  message: ControlMessage
): Promise<void> {
  switch (message.type) {
    case ControlEventType.SESSION_STATUS: {
      // Only host can change session status
      const isHost = await sessionService.isHost(sessionId, userId);
      if (!isHost) {
        socket.emit('error', { code: 'NOT_HOST', message: 'Only host can change session status' });
        return;
      }

      // Map status string to enum
      const statusMap: Record<SessionStatusValue, 'ACTIVE' | 'PAUSED' | 'CLOSED'> = {
        active: 'ACTIVE',
        paused: 'PAUSED',
        closed: 'CLOSED',
      };

      await sessionService.updateSessionStatus(sessionId, userId, statusMap[message.status]);

      // Broadcast to all in session
      namespace.to(getSessionRoom(sessionId)).emit('control', message);
      break;
    }

    case ControlEventType.PERMISSION_CHANGED: {
      // Only host can change permissions (but this should go through REST API ideally)
      const isHost = await sessionService.isHost(sessionId, userId);
      if (!isHost) {
        socket.emit('error', { code: 'NOT_HOST', message: 'Only host can change permissions' });
        return;
      }

      // Notify the guest whose permissions changed
      namespace.to(getUserRoom(message.guestId)).emit('control', message);
      break;
    }

    case ControlEventType.SPOTLIGHT_SHARE: {
      const isHost = await sessionService.isHost(sessionId, userId);
      if (!isHost) {
        socket.emit('error', { code: 'NOT_HOST', message: 'Only host can share spotlight' });
        return;
      }
      namespace.to(getSessionRoom(sessionId)).emit('control', message);
      break;
    }

    default:
      logger.warn({ socketId: socket.id, messageType: (message as { type: string }).type }, 'Unknown control message type');
  }
}

// Utility functions for external use
export function broadcastSessionStatus(
  namespace: Namespace,
  sessionId: string,
  status: SessionStatusValue
): void {
  const message: SessionStatusMessage = {
    type: ControlEventType.SESSION_STATUS,
    status,
    timestamp: Date.now(),
  };
  namespace.to(getSessionRoom(sessionId)).emit('control', message);
}

export function broadcastPermissionChange(
  namespace: Namespace,
  _sessionId: string,
  guestId: string,
  canReceiveFrom: string[]
): void {
  const message: PermissionChangedMessage = {
    type: ControlEventType.PERMISSION_CHANGED,
    guestId,
    canReceiveFrom,
    timestamp: Date.now(),
  };
  namespace.to(getUserRoom(guestId)).emit('control', message);
}
