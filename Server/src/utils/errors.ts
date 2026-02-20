export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// 유효성 검사 실패
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

// 인증 실패 (로그인 필요)
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
    this.name = 'AuthenticationError';
  }
}

// 권한 없음 (접근 거부/호스트 전용 등)
export class AuthorizationError extends AppError {
  constructor(message: string = 'Permission denied') {
    super('AUTHORIZATION_ERROR', message, 403);
    this.name = 'AuthorizationError';
  }
}

// 리소스 없음
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

// 충돌 (중복 등)
export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

// 요청 제한 초과
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super('RATE_LIMITED', message, 429);
    this.name = 'RateLimitError';
  }
}

export enum ProtocolErrorCode {
  SESSION_NOT_FOUND = 1001,
  SESSION_CLOSED = 1002,
  SESSION_FULL = 1003,
  PERMISSION_DENIED = 2001,
  NOT_HOST = 2002,
  INVALID_PACKET = 3001,
  INVALID_STROKE_ID = 3002,
  RATE_LIMITED = 4001,
}

export class ProtocolError extends Error {
  constructor(
    public readonly code: ProtocolErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}
