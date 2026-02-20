import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
let redisPub: Redis | null = null;
let redisSub: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('error', (err) => {
      logger.error(err, 'Redis client error');
    });
  }
  return redisClient;
}

export function getRedisPubClient(): Redis {
  if (!redisPub) {
    redisPub = new Redis(config.redis.url);
    redisPub.on('error', (err) => {
      logger.error(err, 'Redis pub client error');
    });
  }
  return redisPub;
}

export function getRedisSubClient(): Redis {
  if (!redisSub) {
    redisSub = new Redis(config.redis.url);
    redisSub.on('error', (err) => {
      logger.error(err, 'Redis sub client error');
    });
  }
  return redisSub;
}

export async function closeRedis(): Promise<void> {
  const clients = [redisClient, redisPub, redisSub].filter(Boolean) as Redis[];
  await Promise.all(clients.map((c) => c.quit()));
  redisClient = null;
  redisPub = null;
  redisSub = null;
  logger.info('Redis connections closed');
}
