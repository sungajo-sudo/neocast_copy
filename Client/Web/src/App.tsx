import { useEffect, useState, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CanvasContainer } from './components/canvas';
import { SessionLobby, HostSessionView, GuestAnnotationOverlay } from './components/session';
import { useDevBridgeHost } from './hooks/useDevBridgeHost';
import { useDevBridgeGuest } from './hooks/useDevBridgeGuest';
import { devBridge } from './services/dev-bridge';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { HomePage } from './pages/HomePage';
import { CreateSessionPage } from './pages/CreateSessionPage';
import { ArchiveDetailPage } from './pages/ArchiveDetailPage';
import { ReplayPage } from './pages/ReplayPage';
import { StudentReportDetail } from './pages/StudentReportDetail';
import { ToolbarActions, PaperSizeBadge, PenSettingsPopover } from './components/toolbar';
import { AuthPanel } from './components/auth';
// PenConnectionBadge removed - Smartpen is now in the control bar
import { LanguageSelector } from './components/common';
import { useAlert } from './contexts/AlertContext';
import {
  ControlBar,
  LeftPanelContainer,
  RightPanelContainer,
  LeaveConfirmModal,
  SettingsModal,
  MessengerModal,
  PdfUploadModal,
  AboutModal,
} from './components/layout';
import { useSessionStore } from './stores/session-store';
import { useConnectionStore } from './stores/connection-store';
import { useAuthStore } from './stores/auth-store';
import { usePanelStore } from './stores/panel-store';
import { ConnectionState, SessionStatus, ParticipantRole } from './types';
import { authService } from './services/auth-service';
import { sessionService } from './services/session-service';
import { penInputService } from './services/pen-input.service';
import { messengerService } from './services/messenger-service';
import { createInviteLink, parseInviteFromPath } from './utils/invite';
import { FEATURE_FLAGS } from './utils/feature-flags';
import { copyToClipboard } from './utils/clipboard';
import type { InviteData } from './utils/invite';
import watercolorBg from './assets/images/watercolor-bg.png';

// Shared Description Panel Component
const DescriptionPanel = () => {
  const { t } = useTranslation();
  return (
    <div className="hidden md:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
      <div>
        <div className="flex items-center mb-8">
          <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Neo
          </span>
          <span className="text-3xl font-bold text-gray-800">CAST</span>
        </div>

        <h2 className="text-3xl font-bold text-gray-800 mb-4 leading-tight">
          {t('description.title')}<br />
          <span className="text-blue-600">{t('description.titleHighlight')}</span>{t('description.titleSuffix')}
        </h2>
        <p className="text-gray-600 text-lg leading-relaxed">
          {t('description.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 text-gray-600">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </div>
          <span className="font-medium">{t('description.featurePen')}</span>
        </div>
        <div className="flex items-center gap-4 text-gray-600">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <span className="font-medium">{t('description.featureCollab')}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Undo/Redo/Clear 버튼 (Top bar용)
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isGuest, logout } = useAuthStore();
  const session = useSessionStore((state) => state.session);
  const location = useLocation();
  const navigate = useNavigate();

  // 세션이 있으면 인증된 것으로 간주 (게스트 세션 참가 직후 타이밍 문제 방지)
  // isAuthenticated가 아직 true로 반영되지 않았더라도 session이 있으면 인증된 상태
  const effectivelyAuthenticated = isAuthenticated || session !== null;

  // 게스트가 /join 경로에 접근하면 로그아웃 처리 후 게스트 참가 페이지로 이동
  // (게스트는 새 초대 링크마다 새로운 게스트로 참가해야 함)
  // useEffect를 사용하여 렌더링 중 setState 호출 방지
  useEffect(() => {
    if (isGuest && location.pathname.startsWith('/join/')) {
      logout();
      const inviteData = parseInviteFromPath(location.pathname) ?? undefined;
      navigate('/guest-join', { state: { from: location, inviteData }, replace: true });
    }
  }, [isGuest, location, logout, navigate]);

  // 게스트가 /join 경로에 접근 중이면 로그아웃 처리가 완료될 때까지 대기
  if (isGuest && location.pathname.startsWith('/join/')) {
    return null;
  }

  if (!effectivelyAuthenticated) {
    // /join 경로인 경우 게스트 참가 페이지로 이동 (inviteData 전달)
    if (location.pathname.startsWith('/join/')) {
      const inviteData = parseInviteFromPath(location.pathname) ?? undefined;
      return <Navigate to="/guest-join" state={{ from: location, inviteData }} replace />;
    }

    // 다른 경로는 로그인 페이지로 이동
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/**
 * 호스트 전용 가드
 * 인증된 일반 사용자(비게스트)만 접근 허용
 * 미인증 → /login, 게스트 → /lobby
 */
function RequireHost({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isGuest } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (isGuest) {
    return <Navigate to="/lobby" replace />;
  }
  return <>{children}</>;
}


/**
 * 회원가입 페이지
 */
function SignupPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-200 p-4">
      <div className="max-w-md w-full">
        <AuthPanel initialMode="signup" />
      </div>
    </div>
  );
}

/**
 * 게스트 참가 페이지 (로그인 없이 세션 참가)
 */
function GuestJoinPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isGuest, loginAsGuest } = useAuthStore();
  const { serverUrl, connect } = useConnectionStore();
  const { setSession, setCurrentUserId, session } = useSessionStore();

  // 초대 데이터
  const inviteData: InviteData | undefined = (location.state as { inviteData?: InviteData })?.inviteData;

  // localStorage에서 저장된 표시 이름 불러오기
  const DISPLAY_NAME_KEY = 'livecast:guestDisplayName';
  const savedDisplayName = localStorage.getItem(DISPLAY_NAME_KEY) || '';

  // 상태
  const [displayName, setDisplayName] = useState(savedDisplayName);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<{
    allowGuestMode: boolean;
    hasPassword: boolean;
    hostName: string;
    participantCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인되어 있으면 /join으로 리다이렉트 (게스트 제외 — loginAsGuest 후 무한루프 방지)
  useEffect(() => {
    if (isAuthenticated && !isGuest && inviteData) {
      navigate(`/join/${inviteData.code}`, { replace: true });
    }
  }, [isAuthenticated, isGuest, inviteData, navigate]);

  // 세션이 활성화되면 세션 페이지로 이동
  // (handleGuestJoin에서 직접 navigate를 호출하므로 isLoading 체크로 중복 방지)
  useEffect(() => {
    if (session && !isLoading) {
      navigate(`/session/${session.code}`, { replace: true, state: { justJoined: true } });
    }
  }, [session, isLoading, navigate]);

  // 세션 정보 확인 (게스트 모드 허용 여부)
  useEffect(() => {
    if (!inviteData) {
      navigate('/', { replace: true });
      return;
    }

    const checkSession = async () => {
      setIsCheckingSession(true);
      try {
        // DEV 모드: 브릿지에서 세션 정보 조회 (백엔드 없이 동작)
        if (import.meta.env.DEV) {
          const devSession = devBridge.getSession(inviteData.code);
          if (devSession) {
            setSessionInfo({
              allowGuestMode: true,
              hasPassword: false,
              hostName: devSession.hostName,
              participantCount: 1,
            });
            setIsCheckingSession(false);
            return;
          }
        }
        const response = await sessionService.getSessionByCode(inviteData.code);
        setSessionInfo({
          allowGuestMode: response.session.allowGuestMode,
          hasPassword: response.session.hasPassword,
          hostName: response.session.hostName,
          participantCount: response.session.participantCount,
        });

        if (!response.session.allowGuestMode) {
          setError(t('guest.guestNotAllowed'));
        }
      } catch (err) {
        setError(t('session.notFound'));
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, [inviteData, navigate]);

  // 게스트 참가 핸들러
  const handleGuestJoin = async () => {
    if (!inviteData) return;

    setIsLoading(true);
    setError(null);

    try {
      // DEV 모드: 브릿지를 통해 백엔드 없이 참가
      if (import.meta.env.DEV) {
        const devSession = devBridge.getSession(inviteData.code);
        if (devSession) {
          const guestId = 'guest-' + Math.random().toString(36).slice(2, 9);
          const guestName = displayName.trim() || '게스트';

          loginAsGuest(guestId, 'dev-token', guestName);

          // 호스트 탭에 참가 알림
          devBridge.send({
            type: 'GUEST_JOIN',
            userId: guestId,
            userName: guestName,
            code: inviteData.code,
          });

          setCurrentUserId(guestId);
          setSession({
            id: devSession.id,
            code: devSession.code,
            status: SessionStatus.Active,
            hostId: devSession.hostId,
            participants: [
              {
                userId: guestId,
                userName: guestName,
                role: ParticipantRole.Guest,
                joinedAt: Date.now(),
                isMuted: false,
                isSpeaking: false,
              },
            ],
            createdAt: devSession.createdAt,
            hasPassword: false,
          });

          if (displayName.trim()) {
            localStorage.setItem(DISPLAY_NAME_KEY, displayName.trim());
          }

          navigate(`/session/${devSession.code}`, {
            replace: true,
            state: { justJoined: true },
          });
          setIsLoading(false);
          return;
        }
      }

      // 게스트로 세션 참가 (inviteToken 또는 password 사용)
      const response = await sessionService.joinAsGuest(inviteData.code, {
        password: inviteData.password,
        inviteToken: inviteData.inviteToken,
        displayName: displayName || undefined,
      });

      // 게스트로 로그인 처리 (실제 userId는 UUID, guestId는 표시 이름)
      const actualUserId = response.participant.userId;
      loginAsGuest(actualUserId, response.accessToken, displayName || response.guestId);

      // 소켓 연결 (voice/stroke는 Worker에서 자동 연결됨)
      await connect(serverUrl, response.accessToken, response.session.id);

      // 세션 스토어 업데이트 (실제 UUID 사용)
      setCurrentUserId(actualUserId);
      setSession({
        id: response.session.id,
        code: response.session.code,
        status: SessionStatus.Active,
        hostId: response.session.hostId,
        participants: response.session.participants?.map(p => ({
          userId: p.userId,
          userName: p.userName,
          role: p.role as ParticipantRole,
          joinedAt: new Date(p.joinedAt).getTime(),
          isMuted: false,
          isSpeaking: false,
        })) ?? [],
        createdAt: new Date(response.session.createdAt).getTime(),
      });

      // 표시 이름을 입력한 경우 localStorage에 저장
      if (displayName.trim()) {
        localStorage.setItem(DISPLAY_NAME_KEY, displayName.trim());
      }

      // 세션 설정 완료 후 직접 세션 페이지로 이동
      // justJoined 플래그를 전달하여 SessionPage에서 즉시 리다이렉트하지 않도록 함
      navigate(`/session/${response.session.code}`, { replace: true, state: { justJoined: true } });
    } catch (err) {
      const message = err instanceof Error ? err.message : '참가에 실패했습니다.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // 초대 데이터 없으면 홈으로
  if (!inviteData) {
    return null;
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* 세션 정보 카드 */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/60 p-6 mb-6 transition-all hover:shadow-2xl hover:bg-white/90">
          {isCheckingSession ? (
            <div className="text-center py-8">
              <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-600 font-medium">{t('guest.checkingSession')}</p>
            </div>
          ) : sessionInfo ? (
            <>
              {/* 세션 초대 헤더 */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('guest.invited')}</h2>
                <p className="text-gray-600">{t('guest.invitedSubtitle')}</p>
              </div>

              {/* 세션 정보 */}
              <div className="bg-white/50 rounded-xl p-5 mb-6 border border-white/60 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600 text-sm font-medium">{t('session.host')}</span>
                  <span className="font-bold text-gray-800">{sessionInfo.hostName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm font-medium">{t('session.currentParticipants')}</span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs border border-blue-100">{t('session.participantCount', { count: sessionInfo.participantCount })}</span>
                </div>
              </div>

              {sessionInfo.allowGuestMode ? (
                <>
                  {/* 표시 이름 입력 */}
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                      {t('guest.displayName')} <span className="text-gray-400 font-normal text-xs">{t('guest.displayNameOptional')}</span>
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t('guest.displayNamePlaceholder')}
                      className="w-full px-4 py-3 bg-white/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-400"
                      disabled={isLoading}
                    />
                    <p className="mt-2 text-xs text-gray-500 ml-1">
                      * {t('guest.displayNameHint')}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-6 p-4 bg-red-50/80 border border-red-200 text-red-600 rounded-xl text-sm flex items-start">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  )}

                  {/* 참가 버튼 */}
                  <button
                    onClick={handleGuestJoin}
                    disabled={isLoading}
                    autoFocus
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-lg shadow-md hover:shadow-lg transform active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('guest.joining')}
                      </span>
                    ) : t('guest.joinAsGuest')}
                  </button>
                </>
              ) : (
                <>
                  {error && (
                    <div className="mb-6 p-4 bg-amber-50/80 border border-amber-200 text-amber-700 rounded-xl text-sm flex items-start">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('guest.loginRequired')}
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/login', { state: { from: { pathname: `/join/${inviteData.code}` }, inviteData } })}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-bold text-lg shadow-md"
                  >
                    {t('guest.loginToJoinFull')}
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('session.notFound')}</h2>
              <p className="text-gray-500" dangerouslySetInnerHTML={{ __html: t('session.notFoundDescription').replace(/\n/g, '<br />') }} />
            </div>
          )}
        </div>

        {/* 로그인 안내 카드 */}
        {sessionInfo?.allowGuestMode && (
          <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-sm border border-white/50 p-4 text-center transition-all hover:bg-white/80">
            <p className="text-gray-600 text-sm mb-2 font-medium">{t('guest.hasAccount')}</p>
            <button
              onClick={() => navigate('/login', { state: { from: { pathname: `/join/${inviteData.code}` }, inviteData } })}
              className="text-blue-600 hover:text-blue-800 font-bold hover:underline transition-colors"
            >
              {t('guest.loginToJoin')} &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



/**
 * 초대 링크로 참가 페이지
 */
function JoinPage() {
  const session = useSessionStore((state) => state.session);
  const setSession = useSessionStore((state) => state.setSession);
  const setCurrentUserId = useSessionStore((state) => state.setCurrentUserId);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const autoJoinAttempted = useRef(false);

  // 초대 데이터 파싱 (state에서 전달된 것 우선, 없으면 경로에서 파싱)
  // 로그인 후 리다이렉트 시 state로 inviteData가 전달됨 (inviteToken 포함)
  const inviteDataFromState = (location.state as { inviteData?: InviteData })?.inviteData;
  const inviteDataFromPath = parseInviteFromPath(location.pathname);
  const inviteData: InviteData | undefined = inviteDataFromState || inviteDataFromPath || undefined;

  // DEV 모드: devBridge에 세션이 있으면 스토어 직접 세팅해 자동 참가
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!inviteData?.code || !user || session || autoJoinAttempted.current) return;

    const devSession = devBridge.getSession(inviteData.code);
    if (!devSession) return;

    autoJoinAttempted.current = true;
    const guestId = `guest-${user.id}-${Date.now()}`;
    setCurrentUserId(guestId);
    setSession({
      id: devSession.id,
      code: devSession.code,
      status: SessionStatus.Active,
      hostId: devSession.hostId,
      participants: [
        {
          userId: devSession.hostId,
          userName: devSession.hostName,
          role: ParticipantRole.Host,
          joinedAt: devSession.createdAt,
          isMuted: false,
          isSpeaking: false,
        },
        {
          userId: guestId,
          userName: user.name,
          role: ParticipantRole.Guest,
          joinedAt: Date.now(),
          isMuted: false,
          isSpeaking: false,
        },
      ],
      createdAt: devSession.createdAt,
      hasPassword: false,
    });
  }, [inviteData, user, session, setSession, setCurrentUserId]);

  // 세션이 활성화되면 세션 페이지로 이동
  useEffect(() => {
    if (session) {
      navigate(`/session/${session.code}`, { replace: true, state: { justJoined: true } });
    }
  }, [session, navigate]);

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      {/* Container matching LoginPage style */}
      <div className="relative z-10 w-full max-w-5xl flex rounded-3xl overflow-hidden shadow-2xl bg-white/70 backdrop-blur-md border border-white/50 min-h-[600px]">

        <DescriptionPanel />

        {/* Right Side: SessionLobby */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 bg-white/50 flex flex-col justify-center overflow-y-auto">
          <div className="md:hidden flex items-center mb-8 justify-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
            <span className="text-2xl font-bold text-gray-800">CAST</span>
          </div>
          <SessionLobby className="w-full bg-transparent shadow-none border-none p-0" initialInviteData={inviteData} />
        </div>
      </div>
    </div>
  );
}

/**
 * 활성 세션 페이지 (캔버스)
 */
function SessionPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const session = useSessionStore((state) => state.session);
  const selectedViewUserId = useSessionStore((state) => state.selectedViewUserId);
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const isHost = useSessionStore((state) => state.isHost);
  const navigate = useNavigate();

  // DEV 브릿지 훅 (백엔드 없이 멀티탭 테스트)
  useDevBridgeHost(isHost ? (session?.code ?? null) : null);
  useDevBridgeGuest(!isHost ? (session?.code ?? null) : null, currentUserId);

  // 방금 세션에 참가했는지 확인 (GuestJoinPage/JoinPage에서 전달)
  const justJoined = (location.state as { justJoined?: boolean })?.justJoined;

  // 이전 세션 존재 여부를 추적하여 새로고침인지, 세션 종료(나가기)인지 구분
  // 새로고침 시에는 session이 처음부터 null -> /join으로 이동
  // 나가기 시에는 session이 있다가 null로 변경 -> /lobby로 이동
  const prevSessionExists = useRef(!!session);

  const canInput = isHost || selectedViewUserId === currentUserId;

  // DEBUG: isHost 판별 확인
  console.log("[SessionPage] DEBUG:", { isHost, currentUserId, hostId: session?.hostId, sessionCode: session?.code, participants: session?.participants?.map(p => ({ userId: p.userId, role: p.role })) });

  // 세션이 없으면 로비로 이동 (세션 코드와 함께)
  // 단, 방금 참가한 경우(justJoined)에는 세션 상태 반영을 기다림
  // 게스트인 경우 /join/:code로 이동하면 RequireAuth에서 로그아웃되므로 로비로 이동
  useEffect(() => {
    const hasSession = !!session;
    const hadSession = prevSessionExists.current;

    // ref 업데이트
    prevSessionExists.current = hasSession;

    // 방금 참가한 경우 세션 상태가 반영될 때까지 리다이렉트하지 않음
    if (justJoined) return;

    // 1. 세션이 있다가 사라진 경우 (로그아웃, 나가기 등) -> 로비로
    if (hadSession && !hasSession) {
      navigate('/lobby', { replace: true });
      return;
    }

    // 2. 처음부터 세션이 없는 경우 (새로고침, 직접 접속) -> 참가 페이지로
    if (!hasSession && code) {
      const { isGuest } = useAuthStore.getState();
      if (isGuest) {
        // 게스트는 /join/:code로 이동하면 로그아웃되므로 로비로 이동
        navigate('/lobby', { replace: true });
      } else {
        navigate(`/join/${code}`, { replace: true });
      }
    } else if (!hasSession) {
      navigate('/lobby', { replace: true });
    }
  }, [session, code, navigate, justJoined]);

  if (!session) {
    // session이 없으면 항상 로딩 스피너 표시 (return null로 인한 빈 화면 방지)
    // useEffect가 redirect를 처리함 (justJoined일 때는 redirect하지 않고 session을 기다림)
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // 호스트: 뷰 탭 포함 (기본 뷰 / 참가자 모드 뷰)
  if (isHost) {
    return <HostSessionView canInput={canInput} />;
  }

  // 게스트: 캔버스 + 첨삭 오버레이
  return (
    <>
      <CanvasContainer className="flex-1" inputEnabled={canInput} />
      { /* TODO: GuestAnnotationOverlay 무한루프 수정 후 복원 */ }
    </>
  );
}

/**
 * 줌 표시 및 100% Lock 버튼 컴포넌트
 * 헤더에 표시됨
 * compact: true일 때 아이콘만 표시 (퍼센트 숨김)
 */
function ZoomLockIndicator({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const isZoomLocked = usePanelStore((state) => state.isZoomLocked);
  const canvasScale = usePanelStore((state) => state.canvasScale);
  const canvasFitScale = usePanelStore((state) => state.canvasFitScale);
  const resetZoomToFit = usePanelStore((state) => state.resetZoomToFit);

  // 100% = fitScale 기준으로 퍼센트 계산
  const zoomPercent = canvasFitScale > 0 ? Math.round((canvasScale / canvasFitScale) * 100) : 100;

  return (
    <button
      type="button"
      onClick={() => {
        if (!isZoomLocked) {
          resetZoomToFit();
        }
      }}
      className={`${compact ? 'p-1.5' : 'px-2.5 py-1'} rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${isZoomLocked
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-blue-100 cursor-pointer border border-gray-200'
        }`}
      title={`${zoomPercent}% - ${isZoomLocked ? t('canvas.zoomLockOn') : t('canvas.zoomLockOff')}`}
    >
      {!compact && <span>{zoomPercent}%</span>}
      {isZoomLocked ? (
        <svg className={compact ? "w-4 h-4" : "w-3.5 h-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ) : (
        <svg className={compact ? "w-4 h-4" : "w-3.5 h-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

/**
 * NeoCAST 메인 앱
 */
function App() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const isHost = useSessionStore((state) => state.isHost);
  const clearSession = useSessionStore((state) => state.clearSession);
  const connectionState = useConnectionStore((state) => state.state);
  const serverUrl = useConnectionStore((state) => state.serverUrl);
  const disconnect = useConnectionStore((state) => state.disconnect);
  const isConnected = connectionState === ConnectionState.Connected;
  const { user, isAuthenticated, logout } = useAuthStore();

  const navigate = useNavigate();
  const location = useLocation();

  // PaperHub 서버 호스트 이름
  const [paperHubHost, setPaperHubHost] = useState<string | null>(null);

  // 헤더 반응형 상태
  const headerRef = useRef<HTMLElement>(null);
  const [headerCompact, setHeaderCompact] = useState(false); // < 520px: 아이콘만 표시
  const [headerVeryCompact, setHeaderVeryCompact] = useState(false); // < 410px: 로고 완전히 숨김
  const [headerUltraCompact, setHeaderUltraCompact] = useState(false); // < 350px: 언어 선택 숨김

  // 헤더 크기 감지
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const checkSize = () => {
      const headerWidth = header.offsetWidth;
      setHeaderCompact(headerWidth < 520);
      setHeaderVeryCompact(headerWidth < 410);
      setHeaderUltraCompact(headerWidth < 350);
    };

    checkSize();

    const resizeObserver = new ResizeObserver(checkSize);
    resizeObserver.observe(header);

    return () => resizeObserver.disconnect();
  }, []);

  // 페이지 타이틀 설정
  useEffect(() => {
    document.title = `NeoCAST v${__APP_VERSION__}`;
  }, []);

  // PaperHub 서버 정보 가져오기
  useEffect(() => {
    fetch('/api/paperhub/paper-info/server-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.host) {
          setPaperHubHost(data.host);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch PaperHub server info:', err);
      });
  }, []);

  // 패널 스토어 (새로운 Zoom 스타일 레이아웃용)
  const resetPanelState = usePanelStore((state) => state.resetPanelState);
  const toggleMessenger = usePanelStore((state) => state.toggleMessenger);
  const unreadMessengerCount = usePanelStore((state) => state.unreadMessengerCount);
  const isGuest = useAuthStore((state) => state.isGuest);

  // 사용자 드롭다운 메뉴 상태
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 현재 경로가 세션 페이지인지 확인
  const isSessionPage = location.pathname.startsWith('/session/');

  // 글로벌 Toast 메시지 (panel-store에서 관리)
  const toastMessage = usePanelStore((state) => state.toastMessage);
  const showToast = usePanelStore((state) => state.showToast);

  // 비동기 다이얼로그 (window.confirm 대체)
  const { showAlert, showConfirm } = useAlert();
  const kicked = useSessionStore((state) => state.kicked);

  // 초대 배너 상태
  const [isInviteBannerDismissed, setIsInviteBannerDismissed] = useState(false);
  const [isInviteBannerPermanentlyDisabled, setIsInviteBannerPermanentlyDisabled] = useState(() => {
    return localStorage.getItem('livecast:inviteBannerDisabled') === 'true';
  });

  // 세션이 변경되면 배너 다시 표시 (현재 세션에서만 닫힌 상태 리셋)
  useEffect(() => {
    setIsInviteBannerDismissed(false);
  }, [session?.id]);

  // 초대 배너 닫기 핸들러
  const handleDismissInviteBanner = useCallback(async () => {
    setIsInviteBannerDismissed(true);

    // localStorage에서 닫은 횟수 가져와서 증가
    const dismissCount = parseInt(localStorage.getItem('livecast:inviteBannerDismissCount') || '0', 10) + 1;
    localStorage.setItem('livecast:inviteBannerDismissCount', String(dismissCount));

    // 10번 이상 닫았으면 영구 비활성화 여부 확인
    if (dismissCount >= 10 && !isInviteBannerPermanentlyDisabled) {
      const confirmed = await showConfirm(t('invite.hidePrompt'));
      if (confirmed) {
        localStorage.setItem('livecast:inviteBannerDisabled', 'true');
        setIsInviteBannerPermanentlyDisabled(true);
      }
    }
  }, [isInviteBannerPermanentlyDisabled, showConfirm, t]);

  // 세션에서 퇴출당했을 때 알림 및 로비로 이동
  useEffect(() => {
    if (kicked) {
      showAlert(t('participant.kickedMessage'));
      clearSession();
      navigate('/lobby', { replace: true });
    }
  }, [kicked, showAlert, t, clearSession, navigate]);

  // 세션 ID 복사
  const handleCopySessionId = async () => {
    if (session) {
      await copyToClipboard(session.code);
      showToast(t('common.copied'));
      setIsUserMenuOpen(false);
    }
  };

  // 세션 초대링크 복사 (inviteToken 포함하여 비밀번호 없이 참가 가능)
  const handleCopyInviteLink = async () => {
    if (session) {
      // DEBUG: 초대 링크 복사 시 inviteToken 확인
      console.log('[App] handleCopyInviteLink:', {
        code: session.code,
        inviteToken: session.inviteToken,
        hasPassword: session.hasPassword,
      });
      const inviteUrl = createInviteLink(window.location.origin, {
        code: session.code,
        inviteToken: session.inviteToken ?? undefined,
      });
      await copyToClipboard(inviteUrl);
      showToast(t('common.copied'));
      setIsUserMenuOpen(false);
    }
  };

  // 세션 닫기/나가기
  const handleLeaveSession = async () => {

    if (session && user) {
      try {
        const { tokens } = useAuthStore.getState();
        if (tokens?.accessToken) {
          if (isHost) {
            await sessionService.closeSession(tokens.accessToken, session.id);
          } else {
            await sessionService.leaveSession(tokens.accessToken, session.id);
          }
        }
      } catch (error) {
        console.error('Failed to leave session:', error);
      }
    }

    disconnect();
    clearSession();
    navigate('/lobby', { replace: true });
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    setIsUserMenuOpen(false);
    // navigate를 먼저 호출하여 RequireAuth가 /login으로 리다이렉트하기 전에 /로 이동
    navigate('/', { replace: true });
    disconnect();
    clearSession();
    logout();
  };

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 서버 URL 동기화
  useEffect(() => {
    if (serverUrl) {
      const apiUrl = serverUrl.replace(/\/$/, '') + '/api';
      authService.setBaseUrl(apiUrl);
      sessionService.setBaseUrl(apiUrl);
    }
  }, [serverUrl]);

  // NeoSmartpen 입력 서비스 초기화
  useEffect(() => {
    penInputService.initialize();
  }, []);

  // Modifier 키 (CMD/CTRL) 추적 - 터치 입력 자동 비활성화용
  const setModifierKeyPressed = usePanelStore((state) => state.setModifierKeyPressed);
  const setStylusOn = usePanelStore((state) => state.setStylusOn);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        setModifierKeyPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      // metaKey나 ctrlKey가 떼어졌는지 확인
      if (!e.metaKey && !e.ctrlKey) {
        setModifierKeyPressed(false);
        // CMD/CTRL이 떼어지면 터치를 자동으로 ON 상태로 설정
        // (버튼이 OFF 상태였더라도 ON으로 변경)
        setStylusOn(true);
      }
    };
    // 창이 포커스를 잃었다가 다시 얻을 때 modifier 상태 리셋
    const handleBlur = () => {
      setModifierKeyPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [setModifierKeyPressed, setStylusOn]);

  // 세션 종료 시 패널 상태 리셋
  useEffect(() => {
    if (!session) {
      resetPanelState();
    }
  }, [session, resetPanelState]);

  // 메신저 서비스 초기화 (로그인한 일반 사용자만)
  // - 읽지 않은 메시지/친구요청 수 로드
  // - 실시간 알림을 위한 소켓 연결
  useEffect(() => {
    if (FEATURE_FLAGS.MESSENGER_ENABLED && isAuthenticated && !isGuest) {
      // 읽지 않은 수 초기화 및 소켓 연결
      messengerService.initializeUnreadCount();
      messengerService.connect();
    }
  }, [isAuthenticated, isGuest]);

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans relative">
      {/* Background Image for Session Page (others overlay it) */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60 pointer-events-none"
        style={{ backgroundImage: `url(${watercolorBg})` }}
      />
      <div className="absolute inset-0 z-0 bg-white/40 pointer-events-none" />

      {/* 헤더 - Glassmorphism */}
      <header ref={headerRef} className="relative z-20 bg-white/70 backdrop-blur-md border-b border-white/50 pl-4 pr-4 min-[860px]:px-4 py-1 shadow-sm">
        <div className="flex items-center justify-between">
          {/* 왼쪽: 로고 + 툴바 */}
          <div className="flex items-center space-x-2 min-[860px]:space-x-4">
            {/* 로고 - headerVeryCompact가 아닐 때만 표시 */}
            {!headerVeryCompact && (
              <div
                onClick={() => navigate(isAuthenticated && !isGuest ? '/host' : isAuthenticated ? '/lobby' : '/')}
                className="flex items-center gap-1.5 cursor-pointer group"
              >
                {/* headerCompact일 때는 항상 아이콘만 표시 */}
                {headerCompact ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                  </div>
                ) : (
                  <>
                    {/* 로고 텍스트 - 860px 이상 */}
                    {isConnected ? (
                      <div className="hidden min-[860px]:flex items-center text-xl font-bold neo-gradient-animated">
                        NeoCAST
                      </div>
                    ) : (
                      <div className="hidden min-[860px]:flex items-center text-xl font-bold">
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
                        <span className="text-gray-800">CAST</span>
                      </div>
                    )}
                    {/* 아이콘 - 860px 미만 */}
                    <div className="flex min-[860px]:hidden items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      </svg>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 세션 활성화 시 툴바 표시 */}
            {session && (
              <>
                <ToolbarActions />
                {/* PaperSizeBadge - 항상 표시 (compact 모드에서는 아이콘만) */}
                <PaperSizeBadge compact={headerCompact} />
                <PenSettingsPopover />
              </>
            )}
          </div>

          {/* 오른쪽: 줌/언어/유저 정보 */}
          <div className="flex items-center space-x-2 min-[860px]:space-x-4">
            {/* 줌 표시 및 100% Lock 버튼 - 세션 페이지에서만 표시 (compact 모드에서는 아이콘만) */}
            {isSessionPage && session && <ZoomLockIndicator compact={headerCompact} />}

            {/* 언어 선택 - headerUltraCompact (< 350px)일 때 숨김 */}
            {!headerUltraCompact && <LanguageSelector />}

            {/* 메신저 버튼 - 로그인한 일반 사용자만 표시 (게스트 제외) */}
            {FEATURE_FLAGS.MESSENGER_ENABLED && isAuthenticated && !isGuest && (
              <button
                type="button"
                onClick={toggleMessenger}
                className={`relative flex items-center gap-1.5 hover:bg-gray-200 bg-gray-100 rounded-full transition-colors border border-gray-200 ${headerCompact ? 'p-1' : 'pl-1 pr-2.5 py-1'
                  }`}
                title={t('messenger.title', 'Messenger')}
              >
                <div className={`${headerCompact ? 'w-6 h-6' : 'w-5 h-5'} bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center`}>
                  <svg className={`${headerCompact ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                {!headerCompact && (
                  <>
                    <span className="text-xs text-gray-600 hidden min-[860px]:block font-medium">{t('messenger.title', 'Messenger')}</span>
                    <svg className="w-3 h-3 text-gray-400 hidden min-[860px]:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
                {/* 읽지 않은 메시지 배지 */}
                {unreadMessengerCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadMessengerCount > 99 ? '99+' : unreadMessengerCount}
                  </span>
                )}
              </button>
            )}

            {/* 로그인 안된 경우 아바타 아이콘 */}
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-8 h-8 bg-gray-400 hover:bg-gray-500 rounded-full flex items-center justify-center transition-colors"
                title={t('common.login')}
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            )}

            {/* 사용자 정보 표시 (클릭 메뉴) */}
            {isAuthenticated && user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={`flex items-center gap-1.5 hover:bg-gray-200 bg-gray-100 rounded-full transition-colors border border-gray-200 ${headerCompact ? 'p-1' : 'pl-1 pr-2.5 py-1'
                    }`}
                  title={user.name}
                >
                  <div className={`${headerCompact ? 'w-6 h-6' : 'w-5 h-5'} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  {!headerCompact && (
                    <>
                      <span className="text-xs text-gray-600 hidden min-[860px]:block font-medium">{user.name}</span>
                      <svg className="w-3 h-3 text-gray-400 hidden min-[860px]:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* 사용자 드롭다운 메뉴 - Glassmorphism */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white/90 backdrop-blur-xl rounded-lg shadow-lg border border-white/50 py-1 z-50">
                    {/* 역할 표시 */}
                    <div className="px-4 py-2 border-b border-gray-200/50">
                      <div className="text-sm font-medium text-gray-800">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                      {session && (
                        <div className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${isHost ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {isHost ? t('participant.host') : t('participant.guest')}
                        </div>
                      )}
                    </div>

                    {/* 세션 메뉴 항목 (User Menu에 통합) */}
                    {session && (
                      <>
                        <button
                          type="button"
                          onClick={handleCopySessionId}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50/50 flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>{t('sessionMenu.copyCode')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyInviteLink}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50/50 flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span>{t('sessionMenu.copyLink')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleLeaveSession}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-red-50/50 flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>{isHost ? t('sessionMenu.endSession') : t('sessionMenu.leaveSession')}</span>
                        </button>
                        <div className="border-t border-gray-200/50 my-1" />
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50/50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{t('common.profile')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50/50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>{t('common.logout')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* 좌측 패널 컨테이너 - 세션 페이지에서만 표시 (페이지, 내 자료) */}
        {isSessionPage && session && <LeftPanelContainer />}

        {/* 메인 영역 - 라우트에 따라 다른 컴포넌트 표시 */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/session/create" element={<CreateSessionPage />} />
            <Route path="/archive/:archiveId" element={<ArchiveDetailPage />} />
            <Route path="/archive/:archiveId/student/:userId" element={<StudentReportDetail />} />
            <Route path="/archive/:archiveId/replay" element={<ReplayPage />} />

            <Route
              path="/lobby"
              element={
                <RequireAuth>
                  <LobbyPage />
                </RequireAuth>
              }
            />
            <Route
              path="/join/:code"
              element={
                <RequireAuth>
                  <JoinPage />
                </RequireAuth>
              }
            />
            <Route
              path="/session/:code"
              element={
                <RequireAuth>
                  <SessionPage />
                </RequireAuth>
              }
            />
            {/* 알 수 없는 경로는 홈으로 리다이렉트 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* 우측 패널 컨테이너 - 세션 페이지에서만 표시 (Zoom 스타일) */}
        {isSessionPage && session && (
          <RightPanelContainer
            onCopySessionCode={handleCopySessionId}
            onCopyInviteLink={handleCopyInviteLink}
          />
        )}

        {/* 글로벌 Toast 메시지 - 가운데 콘텐츠 영역 중앙 하단에 표시 */}
        {toastMessage && (
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-gray-800/90 backdrop-blur text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300">
            {toastMessage}
          </div>
        )}
      </div>

      {/* 하단 컨트롤 바 - 세션 페이지에서만 표시 (flex 레이아웃의 일부) */}
      {isSessionPage && session && (
        <ControlBar
          onCopySessionCode={handleCopySessionId}
          onCopyInviteLink={handleCopyInviteLink}
        />
      )}

      {/* 초대 배너 - 호스트만 있고 게스트가 없을 때 표시 */}
      {isSessionPage && session && isHost && session.participants.length === 1 && !isInviteBannerDismissed && !isInviteBannerPermanentlyDisabled && (
        <div className="fixed bottom-[80px] left-1/2 transform -translate-x-1/2 z-40">
          <div className="relative bg-gradient-to-r from-blue-500/90 to-purple-600/90 backdrop-blur-md text-white px-6 py-4 pr-10 rounded-2xl shadow-2xl flex items-center gap-4 whitespace-nowrap animate-pulse-slow border border-white/20">
            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={handleDismissInviteBanner}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors"
              title="닫기"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="text-sm sm:text-base font-medium hidden min-[380px]:block">
                {t('invite.title')}
              </span>
            </div>
            <span className="text-xs sm:text-sm text-blue-100 hidden min-[700px]:block">
              {t('invite.subtitle')}
            </span>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {t('invite.copyLink')}
            </button>
          </div>
        </div>
      )}

      {/* 모달들 */}
      <LeaveConfirmModal onConfirm={handleLeaveSession} />
      <SettingsModal />
      {FEATURE_FLAGS.MESSENGER_ENABLED && <MessengerModal />}
      <PdfUploadModal />
      <AboutModal />

      {/* 푸터 - 세션 페이지가 아닐 때만 표시 */}
      {!isSessionPage && (
        <footer className="bg-white/40 backdrop-blur-md border-t border-white/50 px-4 py-2 relative z-20">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              NeoCAST v{__APP_VERSION__}
              {paperHubHost && <span className="text-gray-400 ml-1">({paperHubHost})</span>}
            </span>
            <span>Real-time collaborative drawing</span>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
