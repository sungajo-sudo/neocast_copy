const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

interface ApiError {
  message: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

interface CreateSessionOptions {
  password?: string;
  maxGuests?: number;
  allowGuestVoice?: boolean;
  autoArchive?: boolean;
  allowGuestMode?: boolean; // 비회원 게스트 참가 허용
}

interface SessionResponse {
  success: boolean;
  session: {
    id: string;
    code: string;
    hasPassword: boolean;
    inviteToken?: string | null; // Token for password-free join via invite link (hosts only)
    status: string;
    hostId: string;
    createdAt: string;
    maxGuests: number;
    allowGuestVoice: boolean;
    allowGuestMode: boolean; // 비회원 게스트 참가 허용
  };
}

interface ParticipantInfo {
  id: string;
  userId: string;
  userName: string;
  role: string;
  joinedAt: string;
}

interface JoinSessionResponse {
  success: boolean;
  session: SessionResponse['session'] & {
    participants?: ParticipantInfo[];
  };
  participant: {
    userId: string;
    role: 'HOST' | 'GUEST';
    joinedAt: string;
  };
}

interface SessionInfoResponse {
  success: boolean;
  session: {
    id: string;
    code: string;
    hasPassword: boolean;
    status: string;
    participantCount: number;
    allowGuestMode: boolean; // 비회원 게스트 참가 허용
    hostName: string; // 호스트 이름
  };
}

interface GuestJoinResponse {
  success: boolean;
  guestId: string; // @guest-nnnn 형식의 게스트 ID
  accessToken: string; // 게스트용 임시 토큰
  session: JoinSessionResponse['session'];
  participant: JoinSessionResponse['participant'];
}

interface ReconnectableSessionResponse {
  success: boolean;
  hasDisconnectedSession: boolean;
  session: {
    sessionId: string;
    sessionCode: string;
    participantCount: number;
    disconnectedAt: number;
  } | null;
}

interface ReconnectResponse {
  success: boolean;
  session: SessionResponse['session'] & {
    participants?: ParticipantInfo[];
  };
}

interface PromoteResponse {
  success: boolean;
  participant: ParticipantInfo;
}

class SessionService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
      const error = data as ApiError;
      throw new ApiRequestError(
        error.message || 'Request failed',
        response.status,
        error.error
      );
    }
    return data as T;
  }

  async createSession(
    accessToken: string,
    options: CreateSessionOptions = {}
  ): Promise<SessionResponse> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(options),
    });
    return this.handleResponse<SessionResponse>(response);
  }

  async getSessionByCode(code: string): Promise<SessionInfoResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/code/${code}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return this.handleResponse<SessionInfoResponse>(response);
  }

  /**
   * 세션 상세 정보 가져오기 (호스트는 inviteToken 포함)
   */
  async getSessionById(accessToken: string, sessionId: string): Promise<SessionResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return this.handleResponse<SessionResponse>(response);
  }

  async joinSession(
    accessToken: string,
    code: string,
    options?: { password?: string; inviteToken?: string }
  ): Promise<JoinSessionResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code, password: options?.password, inviteToken: options?.inviteToken }),
    });
    return this.handleResponse<JoinSessionResponse>(response);
  }

  async leaveSession(accessToken: string, sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    await this.handleResponse<{ success: boolean }>(response);
  }

  async closeSession(accessToken: string, sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    await this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * 게스트로 세션 참가 (로그인 없이)
   * @param code 세션 코드
   * @param options.password 세션 비밀번호 (선택)
   * @param options.inviteToken 초대 토큰 (선택, password 대신 사용 가능)
   * @param options.displayName 표시 이름 (선택, 기본값은 서버에서 @guest-nnnn으로 생성)
   */
  async joinAsGuest(
    code: string,
    options?: { password?: string; inviteToken?: string; displayName?: string }
  ): Promise<GuestJoinResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/join-as-guest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        password: options?.password,
        inviteToken: options?.inviteToken,
        displayName: options?.displayName,
      }),
    });
    return this.handleResponse<GuestJoinResponse>(response);
  }

  /**
   * 재연결 가능한 세션 조회 (호스트가 연결이 끊어진 경우)
   */
  async getReconnectableSession(accessToken: string): Promise<ReconnectableSessionResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/reconnectable`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return this.handleResponse<ReconnectableSessionResponse>(response);
  }

  /**
   * 세션에 호스트로 재연결
   */
  async reconnectToSession(accessToken: string, sessionId: string): Promise<ReconnectResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/reconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    return this.handleResponse<ReconnectResponse>(response);
  }

  /**
   * 참가자를 호스트로 임명 (호스트만 가능)
   */
  async promoteToHost(
    accessToken: string,
    sessionId: string,
    userId: string
  ): Promise<PromoteResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/promote/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    return this.handleResponse<PromoteResponse>(response);
  }

  /**
   * 호스트를 게스트로 강등 (원래 호스트만 가능)
   */
  async demoteToGuest(
    accessToken: string,
    sessionId: string,
    userId: string
  ): Promise<PromoteResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/demote/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    return this.handleResponse<PromoteResponse>(response);
  }

  /**
   * 참가자 퇴출 (호스트만 가능)
   */
  async kickParticipant(
    accessToken: string,
    sessionId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/kick/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    return this.handleResponse<{ success: boolean }>(response);
  }
}

export const sessionService = new SessionService();
