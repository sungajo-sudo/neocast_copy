import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/index.js';
import { config } from '../config/index.js';
import { AuthenticationError, ConflictError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// JWT 페이로드 인터페이스
export interface JwtPayload {
  userId: string;
  email: string;
}

// 토큰 쌍 (액세스 토큰, 리프레시 토큰) 인터페이스
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// 사용자 정보 인터페이스
export interface UserInfo {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

const SALT_ROUNDS = 10;

/**
 * 신규 사용자 등록
 * @param email 사용자 이메일
 * @param password 사용자 비밀번호 (6자 이상)
 * @param name 사용자 이름
 * @returns 등록된 사용자 정보
 * @throws ConflictError 이미 존재하는 이메일일 경우
 * @throws ValidationError 비밀번호가 6자 미만일 경우
 */
export async function registerUser(email: string, password: string, name: string): Promise<UserInfo> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  logger.info({ userId: user.id, email: user.email }, 'User registered');
  return user;
}

/**
 * 사용자 로그인
 * 이메일과 비밀번호를 검증하고 토큰을 발급합니다.
 * @param email 사용자 이메일
 * @param password 사용자 비밀번호
 * @returns 사용자 정보와 토큰 쌍(Access/Refresh Token)
 * @throws AuthenticationError 이메일이 없거나 비밀번호가 일치하지 않을 경우
 */
export async function loginUser(email: string, password: string): Promise<{ user: UserInfo; tokens: TokenPair }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AuthenticationError('Invalid email or password');
  }

  const tokens = generateTokens({ userId: user.id, email: user.email });

  logger.info({ userId: user.id }, 'User logged in');

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    tokens,
  };
}

/**
 * JWT 토큰 생성 (Access Token & Refresh Token)
 * @param payload 토큰에 포함할 정보 (userId, email)
 * @returns 생성된 토큰 쌍
 */
export function generateTokens(payload: JwtPayload): TokenPair {
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
}

/**
 * Access Token 검증
 * @param token 검증할 Access Token
 * @returns 디코딩된 페이로드 (userId, email)
 * @throws AuthenticationError 토큰이 유효하지 않거나 만료된 경우, 또는 Refresh Token인 경우
 */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload & { type?: string };
    if (decoded.type === 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }
    return { userId: decoded.userId, email: decoded.email };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    throw error;
  }
}

/**
 * Refresh Token 검증
 * @param token 검증할 Refresh Token
 * @returns 디코딩된 페이로드 (userId, email)
 * @throws AuthenticationError 토큰이 유효하지 않거나 만료된 경우, 또는 Refresh Token이 아닌 경우
 */
export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload & { type?: string };
    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }
    return { userId: decoded.userId, email: decoded.email };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * 토큰 갱신
 * Refresh Token을 사용하여 새로운 Access Token과 Refresh Token을 발급합니다.
 * @param refreshToken 유효한 Refresh Token
 * @returns 새로운 토큰 쌍
 * @throws AuthenticationError 토큰이 유효하지 않거나 사용자를 찾을 수 없는 경우
 */
export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const payload = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  return generateTokens({ userId: user.id, email: user.email });
}

/**
 * ID로 사용자 정보 조회
 * @param userId 사용자 ID
 * @returns 사용자 정보 또는 null
 */
export async function getUserById(userId: string): Promise<UserInfo | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });
}

// 사용자 정보 업데이트 입력 인터페이스
export interface UpdateUserInput {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}

/**
 * 사용자 정보 수정
 * 이름 또는 비밀번호를 변경합니다. 비밀번호 변경 시 현재 비밀번호 확인이 필요합니다.
 * @param userId 사용자 ID
 * @param input 변경할 정보 (이름, 현재 비밀번호, 새 비밀번호)
 * @returns 수정된 사용자 정보
 * @throws AuthenticationError 사용자가 없거나 현재 비밀번호가 틀린 경우
 * @throws ValidationError 비밀번호 변경 조건이 충족되지 않은 경우
 */
export async function updateUser(userId: string, input: UpdateUserInput): Promise<UserInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  const updateData: { name?: string; passwordHash?: string } = {};

  if (input.name) {
    updateData.name = input.name;
  }

  if (input.newPassword) {
    if (!input.currentPassword) {
      throw new ValidationError('Current password is required to change password');
    }

    const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    if (input.newPassword.length < 6) {
      throw new ValidationError('New password must be at least 6 characters');
    }

    updateData.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  }

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No fields to update');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  logger.info({ userId }, 'User updated');
  return updatedUser;
}

/**
 * 회원 탈퇴
 * 비밀번호 확인 후 계정을 삭제합니다.
 * @param userId 사용자 ID
 * @param password 계정 비밀번호
 * @throws AuthenticationError 사용자가 없거나 비밀번호가 틀린 경우
 */
export async function deleteUser(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AuthenticationError('Password is incorrect');
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  logger.info({ userId }, 'User deleted');
}
