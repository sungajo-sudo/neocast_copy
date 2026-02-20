import { Socket } from 'socket.io';
import { verifyAccessToken, JwtPayload } from '../../services/auth.service.js';
import { logger } from '../../utils/logger.js';

export interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
  sessionId?: string;
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn({ socketId: socket.id }, 'Socket connection rejected: No token provided');
      return next(new Error('Authentication required'));
    }

    const payload = verifyAccessToken(token);
    (socket as AuthenticatedSocket).user = payload;

    // Extract session ID from query if provided
    const sessionId = socket.handshake.query.sessionId as string | undefined;
    if (sessionId) {
      (socket as AuthenticatedSocket).sessionId = sessionId;
    }

    logger.debug(
      { socketId: socket.id, userId: payload.userId, sessionId },
      'Socket authenticated'
    );

    next();
  } catch (error) {
    logger.warn({ socketId: socket.id, error }, 'Socket authentication failed');
    next(new Error('Authentication failed'));
  }
}
