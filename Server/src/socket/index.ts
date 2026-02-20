import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedisPubClient, getRedisSubClient } from '../utils/redis.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { socketAuthMiddleware, AuthenticatedSocket } from './middleware/auth.js';
import { setupStrokeNamespace } from './namespaces/stroke.ns.js';
import { setupControlNamespace } from './namespaces/control.ns.js';
import { setupVoiceNamespace } from './namespaces/voice.ns.js';
import { setupChatNamespace } from './namespaces/chat.ns.js';
import { setupMessengerNamespace } from './namespaces/messenger.ns.js';

let io: Server | null = null;

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

export function setupSocketIO(httpServer: HttpServer): { io: Server } {
  io = new Server(httpServer, {
    cors: {
      origin: config.isDev ? '*' : config.cors.origins.length ? config.cors.origins : false,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Setup Redis adapter for scaling
  const pubClient = getRedisPubClient();
  const subClient = getRedisSubClient();
  io.adapter(createAdapter(pubClient, subClient));

  // Global connection handler for root namespace (not recommended for actual use)
  io.on('connection', (socket: Socket) => {
    logger.debug({ socketId: socket.id }, 'Socket connected to root namespace');

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'Socket disconnected from root namespace');
    });
  });

  // Setup namespaces
  const strokeNamespace = io.of('/stroke');
  const controlNamespace = io.of('/control');
  const voiceNamespace = io.of('/voice');
  const chatNamespace = io.of('/chat');
  const messengerNamespace = io.of('/messenger');

  // Apply auth middleware to all namespaces
  strokeNamespace.use(socketAuthMiddleware);
  controlNamespace.use(socketAuthMiddleware);
  voiceNamespace.use(socketAuthMiddleware);
  chatNamespace.use(socketAuthMiddleware);
  messengerNamespace.use(socketAuthMiddleware);

  // Setup namespace handlers
  setupStrokeNamespace(strokeNamespace);
  setupControlNamespace(controlNamespace);
  setupVoiceNamespace(voiceNamespace);
  setupChatNamespace(chatNamespace);
  setupMessengerNamespace(messengerNamespace);

  logger.info('Socket.IO server initialized');

  return { io };
}

// Utility to get session room name
export function getSessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

// Utility to get user room name (for targeting specific user)
export function getUserRoom(userId: string): string {
  return `user:${userId}`;
}

// Broadcast to specific users in a session
export async function broadcastToUsers(
  namespace: string,
  _sessionId: string,
  userIds: string[],
  event: string,
  data: unknown
): Promise<void> {
  if (!io) return;

  const ns = io.of(namespace);
  for (const userId of userIds) {
    ns.to(getUserRoom(userId)).emit(event, data);
  }
}

// Get sockets in a session room
export async function getSocketsInSession(namespace: string, sessionId: string): Promise<AuthenticatedSocket[]> {
  if (!io) return [];

  const ns = io.of(namespace);
  const sockets = await ns.in(getSessionRoom(sessionId)).fetchSockets();
  return sockets as unknown as AuthenticatedSocket[];
}

// Broadcast role change to all participants in session
// When promoting to host, include inviteToken so the new host can share invite links
export async function broadcastRoleChange(
  sessionId: string,
  userId: string,
  newRole: 'host' | 'guest',
  inviteToken?: string | null
): Promise<void> {
  if (!io) return;

  const controlNs = io.of('/control');
  const message = {
    type: 'ROLE_CHANGED' as const,
    userId,
    newRole,
    // Only include inviteToken for the user being promoted (sent to all, but only that user should use it)
    inviteToken: newRole === 'host' ? inviteToken : undefined,
    timestamp: Date.now(),
  };
  controlNs.to(getSessionRoom(sessionId)).emit('control', message);
  logger.info({ sessionId, userId, newRole }, 'Broadcasted role change');
}

// Broadcast participant kick to all participants in session, then force-disconnect the kicked user
export async function broadcastParticipantKick(
  sessionId: string,
  userId: string
): Promise<void> {
  if (!io) return;

  const controlNs = io.of('/control');
  const message = {
    type: 'PARTICIPANT_KICKED' as const,
    userId,
    reason: 'kicked' as const,
    timestamp: Date.now(),
  };
  controlNs.to(getSessionRoom(sessionId)).emit('control', message);
  logger.info({ sessionId, userId }, 'Broadcasted participant kick');

  // Force-disconnect the kicked user's sockets from all namespaces
  const namespaces = ['/control', '/stroke', '/voice', '/chat'];
  for (const ns of namespaces) {
    const namespace = io.of(ns);
    const sockets = await namespace.in(getUserRoom(userId)).fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }
  }
  logger.info({ sessionId, userId }, 'Kicked user sockets disconnected');
}

// Send friend request notification to a specific user via messenger namespace
export function emitFriendRequest(toUserId: string, request: {
  id: string;
  fromUserId: string;
  fromUserEmail: string;
  fromUserName: string;
  toUserId: string;
  toUserEmail: string;
  toUserName: string;
  message: string | null;
  status: string;
  createdAt: Date;
  respondedAt: Date | null;
}): void {
  if (!io) return;

  const messengerNs = io.of('/messenger');
  messengerNs.to(getUserRoom(toUserId)).emit('friend:request', request);
  logger.info({ toUserId, requestId: request.id, fromUserId: request.fromUserId }, 'Friend request notification sent');
}
