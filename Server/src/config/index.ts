import { z } from 'zod';

// 환경 변수 유효성 검사 스키마
const envSchema = z.object({
  PORT: z.coerce.number().default(8190),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  SESSION_CODE_LENGTH: z.coerce.number().default(6),
  MAX_GUESTS_PER_SESSION: z.coerce.number().default(100),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: z.string().default(''),

  // NDP 라우터 및 서비스 관련 설정
  NDP_ROUTER_URL: z.string().default('https://router.neolab.net'),
  NDP_APPLICATION_ID: z.coerce.number().default(1557),
  NDP_RESOURCE_OWNER_ID: z.string().default('neolab'),
  // 폴백 URL (라우터 실패 시 사용)
  NDP_AUTH_URL: z.string().default('https://ndp-dev.onthe.live:7443'),
  NDP_PAPERHUB_URL: z.string().default('https://ndp-dev.onthe.live:8443'),
  NDP_CLIENT_ID: z.string().default('live_cast_service_credential'),
  NDP_CLIENT_SECRET: z.string().default('85w9rNDSG72YgVr66jyOKSnem7zNTaoI'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  host: parsed.data.HOST,
  nodeEnv: parsed.data.NODE_ENV,
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
  cors: {
    origins: parsed.data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  database: {
    url: parsed.data.DATABASE_URL,
  },

  redis: {
    url: parsed.data.REDIS_URL,
  },

  jwt: {
    secret: parsed.data.JWT_SECRET,
    expiresIn: parsed.data.JWT_EXPIRES_IN,
    refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
  },

  session: {
    codeLength: parsed.data.SESSION_CODE_LENGTH,
    maxGuests: parsed.data.MAX_GUESTS_PER_SESSION,
  },

  log: {
    level: parsed.data.LOG_LEVEL,
  },

  ndp: {
    routerUrl: parsed.data.NDP_ROUTER_URL,
    applicationId: parsed.data.NDP_APPLICATION_ID,
    resourceOwnerId: parsed.data.NDP_RESOURCE_OWNER_ID,
    authUrl: parsed.data.NDP_AUTH_URL,
    paperHubUrl: parsed.data.NDP_PAPERHUB_URL,
    clientId: parsed.data.NDP_CLIENT_ID,
    clientSecret: parsed.data.NDP_CLIENT_SECRET,
  },
} as const;

export type Config = typeof config;
