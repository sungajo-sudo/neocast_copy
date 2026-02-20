import { Namespace } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/auth.js';
import { getSessionRoom, getUserRoom } from '../index.js';
import { logger } from '../../utils/logger.js';
import * as sessionService from '../../services/session.service.js';

export function setupVoiceNamespace(namespace: Namespace): void {
  namespace.on('connection', async (rawSocket) => {
    const socket = rawSocket as unknown as AuthenticatedSocket;
    const userId = socket.user.userId;
    const sessionId = socket.handshake.query.sessionId as string;

    logger.info({ socketId: socket.id, userId, sessionId }, 'Voice namespace connection');

    if (!sessionId) {
      socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session ID required' });
      socket.disconnect();
      return;
    }

    // Verify user is participant
    const isParticipant = await sessionService.isParticipant(sessionId, userId);
    if (!isParticipant) {
      socket.emit('error', { code: 'PERMISSION_DENIED', message: 'Not a participant' });
      socket.disconnect();
      return;
    }

    const session = await sessionService.getSessionById(sessionId);
    if (!session) {
      socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
      socket.disconnect();
      return;
    }

    const isHost = session.hostId === userId;
    const canTransmit = isHost || session.allowGuestVoice;

    // Join session room - everyone can listen
    socket.join(getSessionRoom(sessionId));
    socket.join(getUserRoom(userId));
    socket.sessionId = sessionId;

    // Emit ready state with permission info
    socket.emit('voice:ready', {
      sampleRate: 48000,
      channels: 1,
      frameSize: 20,
      canTransmit,
    });

    // Handle voice data - only if permitted
    socket.on('voice:data', (data: Buffer) => {
      if (!canTransmit) {
        return;
      }
      socket.to(getSessionRoom(sessionId)).volatile.emit('voice:data', {
        senderId: userId,
        data,
        timestamp: Date.now(),
      });
    });

    socket.on('voice:start', () => {
      if (!canTransmit) return;
      logger.debug({ socketId: socket.id, userId }, 'Voice start');
      socket.to(getSessionRoom(sessionId)).emit('voice:start', { userId });
    });

    socket.on('voice:end', () => {
      if (!canTransmit) return;
      logger.debug({ socketId: socket.id, userId }, 'Voice end');
      socket.to(getSessionRoom(sessionId)).emit('voice:end', { userId });
    });

    socket.on('voice:mute', () => {
      if (!canTransmit) return;
      socket.to(getSessionRoom(sessionId)).emit('voice:mute', { userId });
    });

    socket.on('voice:unmute', () => {
      if (!canTransmit) return;
      socket.to(getSessionRoom(sessionId)).emit('voice:unmute', { userId });
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId, sessionId, reason }, 'Voice namespace disconnection');
    });

    socket.on('error', (error) => {
      logger.error({ socketId: socket.id, error }, 'Socket error in voice namespace');
    });
  });
}
