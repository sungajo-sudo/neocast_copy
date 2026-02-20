// 인증 관련 타입
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  success: boolean;
  user: User;
  tokens: AuthTokens;
}

export interface RegisterResponse {
  success: boolean;
  user: User;
}
