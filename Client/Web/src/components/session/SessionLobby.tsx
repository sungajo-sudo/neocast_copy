import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useSessionStore } from '../../stores/session-store';
import { sessionService, ApiRequestError } from '../../services/session-service';
import { ConnectionState, SessionStatus, ParticipantRole } from '../../types';
import type { InviteData } from '../../utils/invite';

interface SessionLobbyProps {
  className?: string;
  initialInviteData?: InviteData;
}

/**
 * 랜덤 비밀번호 생성 (6자리 영숫자)
 */
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Zoom 스타일 세션 로비 - 로그인 후 세션 생성/참가 선택
 */
export const SessionLobby: React.FC<SessionLobbyProps> = ({
  className = '',
  initialInviteData,
}) => {
  const { t } = useTranslation();
  const { tokens, user, logout } = useAuthStore();
  const { serverUrl, state: connectionState, connect } = useConnectionStore();
  const { setSession, setCurrentUserId, session } = useSessionStore();

  // 세션 생성 상태 (기본값: 랜덤 비밀번호)
  const [sessionPassword, setSessionPassword] = useState(() => generateRandomPassword());
  const [allowGuestMode, setAllowGuestMode] = useState(true); // 게스트 모드 (기본값: 체크됨)
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 세션 참가 상태
  const [joinCode, setJoinCode] = useState(initialInviteData?.code || '');
  const [joinPassword, setJoinPassword] = useState(initialInviteData?.password || '');
  const [joinInviteToken] = useState(initialInviteData?.inviteToken); // From invite link
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  // 재연결 상태
  const [reconnectableSession, setReconnectableSession] = useState<{
    sessionId: string;
    sessionCode: string;
    participantCount: number;
    disconnectedAt: number;
  } | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // 자동 참가 시도 여부 (한 번만 실행)
  const autoJoinAttempted = useRef(false);

  const isConnected = connectionState === ConnectionState.Connected;

  // URL에서 초대 데이터 확인 및 자동 참가 시도
  useEffect(() => {
    if (initialInviteData) {
      setJoinCode(initialInviteData.code);
      if (initialInviteData.password) {
        setJoinPassword(initialInviteData.password);
      }
      checkSessionPassword(initialInviteData.code);
    }
  }, [initialInviteData]);

  // 재연결 가능한 세션 확인 (페이지 로드 후 일정 시간 동안 폴링)
  // 호스트가 페이지를 떠나고 바로 재접속하면 서버가 disconnect를 처리하기 전에
  // 클라이언트가 reconnectable 세션을 조회할 수 있으므로 폴링이 필요
  useEffect(() => {
    if (!tokens?.accessToken || initialInviteData) return;

    let pollCount = 0;
    const maxPolls = 5; // 최대 5회 폴링 (총 10초)
    const pollInterval = 2000; // 2초 간격
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkReconnectable = async () => {
      try {
        const response = await sessionService.getReconnectableSession(tokens.accessToken);
        if (response.hasDisconnectedSession && response.session) {
          setReconnectableSession(response.session);
          // 세션을 찾으면 폴링 중단
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return true;
        }
      } catch (error) {
        console.error('Failed to check reconnectable session:', error);
      }
      return false;
    };

    // 이미 reconnectable session이 있거나 사용자가 dismiss한 경우 폴링 안 함
    if (reconnectableSession) return;

    // 첫 번째 체크를 즉시 실행
    checkReconnectable().then((found) => {
      if (found) return;

      // 찾지 못했으면 폴링 시작
      intervalId = setInterval(async () => {
        pollCount++;
        const found = await checkReconnectable();

        // 최대 폴링 횟수에 도달하면 중단
        if (found || pollCount >= maxPolls) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      }, pollInterval);
    });

    // 클린업
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [tokens, initialInviteData, reconnectableSession]);

  // 세션 재연결 핸들러
  const handleReconnect = useCallback(async () => {
    if (!tokens?.accessToken || !user || !reconnectableSession) return;

    setIsReconnecting(true);
    try {
      const response = await sessionService.reconnectToSession(
        tokens.accessToken,
        reconnectableSession.sessionId
      );

      // 소켓 연결
      const success = await connectToSession(response.session.id);
      if (!success) {
        throw new Error('Failed to connect to server');
      }

      // 세션 스토어 업데이트
      setCurrentUserId(user.id);
      const participants = response.session.participants?.map(p => ({
        userId: p.userId,
        userName: p.userName,
        role: p.role as ParticipantRole,
        joinedAt: new Date(p.joinedAt).getTime(),
        isMuted: false,
        isSpeaking: false,
      })) ?? [];

      setSession({
        id: response.session.id,
        code: response.session.code,
        status: SessionStatus.Active,
        hostId: response.session.hostId,
        participants,
        createdAt: new Date(response.session.createdAt).getTime(),
        hasPassword: response.session.hasPassword,
        inviteToken: response.session.inviteToken, // Host reconnecting gets inviteToken
      });

      setReconnectableSession(null);
    } catch (error) {
      console.error('Failed to reconnect:', error);
      // 재연결 실패 시 프롬프트 닫기
      setReconnectableSession(null);
    } finally {
      setIsReconnecting(false);
    }
  }, [tokens, user, reconnectableSession, setSession, setCurrentUserId]);

  // 재연결 거부 핸들러
  const handleDismissReconnect = useCallback(() => {
    setReconnectableSession(null);
  }, []);

  // 세션 비밀번호 필요 여부 확인
  const checkSessionPassword = async (code: string) => {
    if (code.length !== 6) return;

    setIsCheckingSession(true);
    try {
      const response = await sessionService.getSessionByCode(code);
      setNeedsPassword(response.session.hasPassword);
      setJoinError(null);
    } catch (error) {
      // 세션을 찾을 수 없어도 에러 표시하지 않음 (입력 중일 수 있음)
    } finally {
      setIsCheckingSession(false);
    }
  };

  // 세션 코드 변경 핸들러
  const handleCodeChange = (value: string) => {
    const code = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setJoinCode(code);
    setJoinError(null);
    if (code.length === 6) {
      checkSessionPassword(code);
    } else {
      setNeedsPassword(false);
    }
  };

  // 비밀번호 또는 초대 토큰이 포함된 초대 링크로 접속 시 자동 참가
  useEffect(() => {
    if (
      (initialInviteData?.password || initialInviteData?.inviteToken) &&
      tokens?.accessToken &&
      user &&
      !autoJoinAttempted.current &&
      !isJoining &&
      !session
    ) {
      autoJoinAttempted.current = true;
      // 약간의 지연 후 자동 참가 시도
      const timer = setTimeout(() => {
        handleJoinSession();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialInviteData, tokens, user, isJoining, session]);

  // 소켓 연결 (sessionId를 쿼리 파라미터로 전달)
  const connectToSession = async (sessionId: string) => {
    if (!tokens?.accessToken) return false;

    // 이미 연결되어 있으면 재연결 필요 (다른 세션일 수 있음)
    if (isConnected) {
      useConnectionStore.getState().disconnect();
    }

    // 세션 ID와 함께 소켓 연결
    const connected = await connect(serverUrl, tokens.accessToken, sessionId);
    return connected;
  };

  // 세션 생성
  const handleCreateSession = useCallback(async () => {
    if (!tokens?.accessToken || !user) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      // 1. REST API로 세션 생성
      const response = await sessionService.createSession(tokens.accessToken, {
        password: sessionPassword || undefined,
        allowGuestMode,
      });

      // DEBUG: inviteToken 추적
      console.log('[SessionLobby] createSession response:', {
        sessionId: response.session.id,
        code: response.session.code,
        hasPassword: response.session.hasPassword,
        inviteToken: response.session.inviteToken,
      });

      // 2. 소켓 연결 (sessionId와 함께)
      const success = await connectToSession(response.session.id);
      if (!success) {
        throw new Error('Failed to connect to server');
      }

      // 3. 세션 스토어 업데이트 (inviteToken 포함)
      setCurrentUserId(user.id);
      const sessionData = {
        id: response.session.id,
        code: response.session.code,
        status: SessionStatus.Active,
        hostId: user.id,
        participants: [
          {
            userId: user.id,
            userName: user.name,
            role: ParticipantRole.Host,
            joinedAt: Date.now(),
            isMuted: false,
            isSpeaking: false,
          },
        ],
        createdAt: Date.now(),
        hasPassword: response.session.hasPassword,
        inviteToken: response.session.inviteToken, // From server response
      };
      // DEBUG: setSession에 전달되는 데이터 확인
      console.log('[SessionLobby] setSession data:', {
        inviteToken: sessionData.inviteToken,
        hasPassword: sessionData.hasPassword,
      });
      setSession(sessionData);
    } catch (error) {
      // 401 에러 시 자동 로그아웃 (토큰이 유효하지 않음)
      if (error instanceof ApiRequestError && error.status === 401) {
        logout();
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to create session';
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  }, [tokens, user, sessionPassword, serverUrl, connect, setSession, setCurrentUserId, logout]);

  // 세션 참가
  const handleJoinSession = useCallback(async () => {
    if (!tokens?.accessToken || !user || !joinCode) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      // 1. REST API로 세션 참가 (inviteToken 또는 비밀번호 사용)
      const response = await sessionService.joinSession(
        tokens.accessToken,
        joinCode,
        {
          password: joinPassword || undefined,
          inviteToken: joinInviteToken,
        }
      );

      // 2. 소켓 연결 (sessionId와 함께)
      const success = await connectToSession(response.session.id);
      if (!success) {
        throw new Error('Failed to connect to server');
      }

      // 3. 세션 스토어 업데이트 (서버에서 받은 전체 참가자 목록 사용)
      setCurrentUserId(user.id);
      const participants = response.session.participants?.map(p => ({
        userId: p.userId,
        userName: p.userName,
        role: p.role as ParticipantRole,
        joinedAt: new Date(p.joinedAt).getTime(),
        isMuted: false,
        isSpeaking: false,
      })) ?? [{
        userId: user.id,
        userName: user.name,
        role: ParticipantRole.Guest,
        joinedAt: Date.now(),
        isMuted: false,
        isSpeaking: false,
      }];

      setSession({
        id: response.session.id,
        code: response.session.code,
        status: SessionStatus.Active,
        hostId: response.session.hostId,
        participants,
        createdAt: new Date(response.session.createdAt).getTime(),
        hasPassword: response.session.hasPassword,
        inviteToken: response.session.inviteToken, // Only included for hosts
      });
    } catch (error) {
      // 401 에러 시 자동 로그아웃 (토큰이 유효하지 않음)
      if (error instanceof ApiRequestError && error.status === 401) {
        logout();
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to join session';
      setJoinError(message);
    } finally {
      setIsJoining(false);
    }
  }, [tokens, user, joinCode, joinPassword, joinInviteToken, needsPassword, serverUrl, connect, setSession, setCurrentUserId, logout]);

  // 이미 세션에 참가 중이면 표시하지 않음
  if (session) {
    return null;
  }

  // 초대 링크로 접속한 경우 참가 섹션만 표시
  const isJoinOnly = !!initialInviteData;
  // 비밀번호 또는 초대 토큰 포함 초대 링크로 자동 참가 중
  const isAutoJoining = isJoinOnly && (initialInviteData?.password || initialInviteData?.inviteToken) && isJoining;

  return (
    <div className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/60 p-8 transition-all hover:bg-white/90 ${className}`}>
      {/* 재연결 프롬프트 */}
      {reconnectableSession && (
        <div className="mb-6 p-4 bg-yellow-50/80 border border-yellow-200 rounded-xl backdrop-blur-sm">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-800 mb-1">
                {t('sessionReconnect.title')}
              </h3>
              <p className="text-sm text-yellow-700 mb-3">
                <span dangerouslySetInnerHTML={{ __html: t('sessionReconnect.message', { code: reconnectableSession.sessionCode, count: reconnectableSession.participantCount }) }} />
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors text-sm font-bold shadow-sm"
                >
                  {isReconnecting ? t('sessionReconnect.reconnecting') : t('sessionReconnect.reconnectButton')}
                </button>
                <button
                  onClick={handleDismissReconnect}
                  disabled={isReconnecting}
                  className="px-4 py-2 bg-white/50 text-yellow-800 border border-yellow-200 rounded-lg hover:bg-white/80 transition-colors text-sm font-medium"
                >
                  {t('sessionReconnect.dismissButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
        {isJoinOnly ? t('sessionJoin.welcome') : 'NeoCAST Session'}
      </h2>

      <div className={isJoinOnly ? '' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}>
        {/* 세션 생성 - 초대 링크로 접속한 경우 숨김 */}
        {!isJoinOnly && (
          <div className="bg-white/50 rounded-xl p-5 flex flex-col border border-white/60 shadow-sm transition-all hover:bg-white/60">
            <div className="flex items-center justify-center mb-5">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3 shadow-inner">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800">{t('lobby.newSession')}</h3>
            </div>

            <div className="flex-1">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {t('sessionCreate.password')}
                </label>
                <input
                  type="text"
                  value={sessionPassword}
                  onChange={(e) => setSessionPassword(e.target.value)}
                  placeholder={t('sessionCreate.passwordPlaceholder')}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-center tracking-wider text-lg transition-all"
                  disabled={isCreating}
                />
                <p className="mt-2 text-xs text-center text-gray-500">
                  {t('sessionCreate.passwordHint')}
                </p>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-50/80 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
                  {createError}
                </div>
              )}

              {/* 게스트 모드 체크박스 */}
              <div className="mb-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowGuestMode}
                    onChange={(e) => setAllowGuestMode(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all"
                    disabled={isCreating}
                  />
                  <span className="ml-2.5 text-sm font-bold text-gray-700">{t('sessionCreate.allowGuest')}</span>
                </label>
                <p className="mt-1.5 text-xs text-blue-600/80 ml-7 leading-relaxed">
                  {t('sessionCreate.allowGuestHint')}
                </p>
              </div>
            </div>

            <button
              onClick={handleCreateSession}
              disabled={isCreating}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-lg shadow-md mt-auto"
            >
              {isCreating ? t('sessionCreate.creating') : t('sessionCreate.createButton')}
            </button>
          </div>
        )}

        {/* 세션 참가 */}
        <div className="bg-white/50 rounded-xl p-5 flex flex-col border border-white/60 shadow-sm transition-all hover:bg-white/60">
          <div className="flex items-center justify-center mb-5">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-3 shadow-inner">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800">{t('sessionJoin.title')}</h3>
          </div>

          <div className="flex-1">
            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {t('sessionJoin.code')}
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder={t('sessionJoin.codePlaceholder')}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 uppercase text-center text-3xl tracking-[0.2em] font-mono text-gray-800 transition-all placeholder-gray-300"
                maxLength={6}
                disabled={isJoining}
              />
            </div>

            {/* 비밀번호 입력 - 초대 데이터에 비밀번호/토큰이 없는 경우 항상 표시 (필요 없으면 비워둠) */}
            {!initialInviteData?.password && !initialInviteData?.inviteToken && (
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {t('sessionJoin.password')} <span className="text-gray-400 font-normal text-xs">{t('sessionJoin.passwordOptional')}</span>
                </label>
                <input
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder={t('sessionCreate.passwordPlaceholder')}
                  className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all ${needsPassword
                    ? 'border-orange-300 focus:ring-orange-500/50 bg-orange-50/50'
                    : 'border-gray-200 focus:ring-green-500/50'
                    }`}
                  disabled={isJoining}
                />
                {needsPassword && (
                  <div className="mt-2 text-xs text-orange-600 font-bold flex items-center animate-pulse">
                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {t('sessionJoin.passwordRequired')}
                  </div>
                )}
              </div>
            )}

            {/* 자동 참가 중 표시 */}
            {isAutoJoining && (
              <div className="mb-4 p-4 bg-blue-50/80 border border-blue-100 text-blue-800 rounded-xl text-sm text-center shadow-sm">
                <div className="flex items-center justify-center font-medium">
                  <svg className="animate-spin h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('sessionJoin.autoConnecting')}
                </div>
              </div>
            )}

            {joinError && (
              <div className="mb-4 p-3 bg-red-50/80 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
                {joinError}
              </div>
            )}
          </div>

          <button
            onClick={handleJoinSession}
            disabled={isJoining || joinCode.length !== 6 || isCheckingSession}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-lg shadow-md mt-auto transform active:scale-[0.98]"
          >
            {isJoining ? t('sessionJoin.joining') : isCheckingSession ? t('sessionJoin.checking') : t('sessionJoin.joinButton')}
          </button>

          {/* 초대 링크로 접속한 경우 - 다른 세션 선택 링크 */}
          {isJoinOnly && (
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  window.history.replaceState({}, '', '/');
                  window.location.reload();
                }}
                className="text-sm text-gray-500 hover:text-gray-800 underline transition-colors"
              >
                {t('sessionJoin.otherCode')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export default SessionLobby;
