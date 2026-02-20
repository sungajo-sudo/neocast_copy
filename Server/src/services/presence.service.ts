import { getRedisClient } from '../utils/redis.js';
import { logger } from '../utils/logger.js';

// 프레즌스 상태 타입
export type PresenceStatus = 'online' | 'offline' | 'busy' | 'away';

// 프레즌스 정보 인터페이스
export interface PresenceInfo {
  userId: string;
  status: PresenceStatus;
  lastSeen: number;
  sessionId?: string;
}

// Redis 키 프리픽스
const PRESENCE_PREFIX = 'presence:';
const PRESENCE_TTL = 60 * 5; // 5분 (heartbeat 기반)

/**
 * 사용자 온라인 상태 설정
 */
export async function setOnline(userId: string, sessionId?: string): Promise<void> {
  const redis = getRedisClient();
  const key = PRESENCE_PREFIX + userId;

  const data: PresenceInfo = {
    userId,
    status: 'online',
    lastSeen: Date.now(),
    sessionId,
  };

  await redis.setex(key, PRESENCE_TTL, JSON.stringify(data));
  logger.debug({ userId, status: 'online' }, 'Presence updated');
}

/**
 * 사용자 오프라인 상태 설정
 */
export async function setOffline(userId: string): Promise<void> {
  const redis = getRedisClient();
  const key = PRESENCE_PREFIX + userId;

  // 오프라인 상태 저장 (짧은 TTL로 - 빠른 동기화 위해)
  const data: PresenceInfo = {
    userId,
    status: 'offline',
    lastSeen: Date.now(),
  };

  await redis.setex(key, 60, JSON.stringify(data)); // 1분 후 자동 삭제
  logger.debug({ userId, status: 'offline' }, 'Presence updated');
}

/**
 * 사용자 바쁨 상태 설정
 */
export async function setBusy(userId: string): Promise<void> {
  const redis = getRedisClient();
  const key = PRESENCE_PREFIX + userId;

  const existing = await redis.get(key);
  const data: PresenceInfo = existing
    ? { ...JSON.parse(existing), status: 'busy', lastSeen: Date.now() }
    : { userId, status: 'busy', lastSeen: Date.now() };

  await redis.setex(key, PRESENCE_TTL, JSON.stringify(data));
  logger.debug({ userId, status: 'busy' }, 'Presence updated');
}

/**
 * 사용자 자리비움 상태 설정
 */
export async function setAway(userId: string): Promise<void> {
  const redis = getRedisClient();
  const key = PRESENCE_PREFIX + userId;

  const existing = await redis.get(key);
  const data: PresenceInfo = existing
    ? { ...JSON.parse(existing), status: 'away', lastSeen: Date.now() }
    : { userId, status: 'away', lastSeen: Date.now() };

  await redis.setex(key, PRESENCE_TTL, JSON.stringify(data));
  logger.debug({ userId, status: 'away' }, 'Presence updated');
}

/**
 * 하트비트 - 온라인 상태 갱신
 */
export async function heartbeat(userId: string): Promise<void> {
  const redis = getRedisClient();
  const key = PRESENCE_PREFIX + userId;

  const existing = await redis.get(key);
  if (existing) {
    const data: PresenceInfo = JSON.parse(existing);
    data.lastSeen = Date.now();
    await redis.setex(key, PRESENCE_TTL, JSON.stringify(data));
  } else {
    await setOnline(userId);
  }
}

/**
 * 단일 사용자의 프레즌스 상태 조회
 */
export async function getPresence(userId: string): Promise<PresenceInfo> {
  const redis = getRedisClient();
  const key = PRESENCE_PREFIX + userId;

  const data = await redis.get(key);
  if (data) {
    return JSON.parse(data);
  }

  return {
    userId,
    status: 'offline',
    lastSeen: 0,
  };
}

/**
 * 여러 사용자의 프레즌스 상태 조회
 */
export async function getPresenceBulk(userIds: string[]): Promise<Map<string, PresenceInfo>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const redis = getRedisClient();
  const keys = userIds.map((id) => PRESENCE_PREFIX + id);

  const values = await redis.mget(...keys);
  const result = new Map<string, PresenceInfo>();

  userIds.forEach((userId, index) => {
    const data = values[index];
    if (data) {
      result.set(userId, JSON.parse(data));
    } else {
      result.set(userId, {
        userId,
        status: 'offline',
        lastSeen: 0,
      });
    }
  });

  return result;
}

/**
 * 온라인 상태인 사용자 ID 목록 반환
 */
export async function getOnlineUserIds(userIds: string[]): Promise<string[]> {
  const presenceMap = await getPresenceBulk(userIds);
  const online: string[] = [];

  presenceMap.forEach((info, userId) => {
    if (info.status === 'online' || info.status === 'busy' || info.status === 'away') {
      online.push(userId);
    }
  });

  return online;
}

/**
 * 사용자가 현재 온라인인지 확인
 */
export async function isOnline(userId: string): Promise<boolean> {
  const presence = await getPresence(userId);
  return presence.status !== 'offline';
}
