import type { User, AuthTokens, LoginResponse, RegisterResponse } from '../types/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// localStorage key for persisted auth state (must match auth-store.ts)
const STORAGE_KEY = 'penstream-auth';

class AuthService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  /**
   * Get the current access token from persisted auth state
   */
  getAccessToken(): string | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.state?.tokens?.accessToken || null;
    } catch {
      return null;
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
      const error = data as ApiError;
      throw new Error(error.message || 'Request failed');
    }
    return data as T;
  }

  async register(email: string, password: string, name: string): Promise<RegisterResponse> {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    return this.handleResponse<RegisterResponse>(response);
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return this.handleResponse<LoginResponse>(response);
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await fetch(`${this.baseUrl}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await this.handleResponse<{ success: boolean; tokens: AuthTokens }>(response);
    return data.tokens;
  }

  async getMe(accessToken: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await this.handleResponse<{ success: boolean; user: User }>(response);
    return data.user;
  }

  async updateMe(
    accessToken: string,
    data: { name?: string; currentPassword?: string; newPassword?: string }
  ): Promise<User> {
    const response = await fetch(`${this.baseUrl}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    });
    const result = await this.handleResponse<{ success: boolean; user: User }>(response);
    return result.user;
  }

  async deleteMe(accessToken: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password }),
    });
    await this.handleResponse<{ success: boolean; message: string }>(response);
  }
}

export const authService = new AuthService();
