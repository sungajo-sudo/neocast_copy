import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { ValidationError } from '../utils/errors.js';

// 회원가입 요청 스키마
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6), // 최소 6자 이상
  name: z.string().min(1).max(100),
});

// 로그인 요청 스키마
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// 토큰 갱신 요청 스키마
const refreshSchema = z.object({
  refreshToken: z.string(),
});

// 사용자 정보 수정 요청 스키마
const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  currentPassword: z.string().optional(), // 비밀번호 변경 시 필수
  newPassword: z.string().min(6).optional(), // 비밀번호 변경 시 필수
});

// 회원 탈퇴 요청 스키마
const deleteUserSchema = z.object({
  password: z.string(), // 계정 삭제 확인용 비밀번호
});

/**
 * 인증 및 사용자 관리 관련 API 라우트
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  // 회원가입
  app.post('/register', async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const { email, password, name } = result.data;
    const user = await authService.registerUser(email, password, name);

    return reply.status(201).send({
      success: true,
      user,
    });
  });

  // 로그인
  app.post('/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const { email, password } = result.data;
    const { user, tokens } = await authService.loginUser(email, password);

    return reply.send({
      success: true,
      user,
      tokens,
    });
  });

  // 토큰 갱신 (Refresh Token 사용)
  app.post('/token/refresh', async (request, reply) => {
    const result = refreshSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const { refreshToken } = result.data;
    const tokens = await authService.refreshTokens(refreshToken);

    return reply.send({
      success: true,
      tokens,
    });
  });

  // 현재 사용자 정보 조회
  app.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new ValidationError('Authorization header required');
    }

    const token = authHeader.slice(7);
    const payload = authService.verifyAccessToken(token);
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      throw new ValidationError('User not found');
    }

    return reply.send({
      success: true,
      user,
    });
  });

  // 사용자 정보 수정
  app.patch('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new ValidationError('Authorization header required');
    }

    const token = authHeader.slice(7);
    const payload = authService.verifyAccessToken(token);

    const result = updateUserSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    const user = await authService.updateUser(payload.userId, result.data);

    return reply.send({
      success: true,
      user,
    });
  });

  // 회원 탈퇴 (비밀번호 확인 필요)
  app.delete('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new ValidationError('Authorization header required');
    }

    const token = authHeader.slice(7);
    const payload = authService.verifyAccessToken(token);

    const result = deleteUserSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten().fieldErrors);
    }

    await authService.deleteUser(payload.userId, result.data.password);

    return reply.send({
      success: true,
      message: 'Account deleted successfully',
    });
  });
};
