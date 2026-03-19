import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useConnectionStore } from '../stores/connection-store';
import { useSessionStore } from '../stores/session-store';
import { sessionService, ApiRequestError } from '../services/session-service';
import { devBridge } from '../services/dev-bridge';
import { SessionStatus, ParticipantRole } from '../types';
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateCode(nickname: string): string {
  const base = nickname.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || 'NEO';
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return (base + rand).padEnd(6, 'X').slice(0, 6);
}

type Mode = 'create' | 'join';

export function CreateSessionPage() {
  const navigate = useNavigate();
  const { tokens, user, devMockLogin } = useAuthStore();
  const { serverUrl, connect } = useConnectionStore();
  const { setSession, setCurrentUserId, session } = useSessionStore();

  const [mode, setMode] = useState<Mode>('create');

  // 세션 생성 필드
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionPassword, setSessionPassword] = useState(generatePassword);
  const [allowGuestMode, setAllowGuestMode] = useState(true);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // 세션 참가 필드
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [joinPasswordError, setJoinPasswordError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const sessionCodePreview = useRef(
    generateCode(localStorage.getItem('nc_auth')
      ? JSON.parse(localStorage.getItem('nc_auth')!).nickname ?? ''
      : '')
  ).current;

  const titleInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tokens?.accessToken) devMockLogin('host');
  }, []);

  useEffect(() => {
    if (session) navigate(`/session/${session.code}`, { replace: true, state: { justJoined: true } });
  }, [session, navigate]);

  const connectToSession = async (sessionId: string) => {
    if (!tokens?.accessToken) return false;
    useConnectionStore.getState().disconnect();
    return connect(serverUrl, tokens.accessToken, sessionId);
  };

  const validateTitle = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return '세션명을 입력해주세요';
    if (trimmed.length < 2) return '세션명은 최소 2자 이상 입력해주세요';
    if (trimmed.length > 30) return '세션명은 30자 이하로 입력해주세요';
    return null;
  };

  const validatePassword = (value: string): string | null => {
    if (!value) return null; // 빈값 허용 (비밀번호 없는 세션)
    if (value.length !== 6) return '비밀번호는 6자리로 입력해주세요';
    return null;
  };

  const handleCreate = useCallback(async () => {
    const titleErr = validateTitle(sessionTitle);
    if (titleErr) {
      setTitleError(titleErr);
      titleInputRef.current?.focus();
      return;
    }
    const pwErr = validatePassword(sessionPassword);
    if (pwErr) {
      setPasswordError(pwErr);
      return;
    }
    if (!tokens?.accessToken || !user) return;

    setIsCreating(true);
    setCreateError(null);
    setTitleError(null);
    setPasswordError(null);

    try {
      const response = await sessionService.createSession(tokens.accessToken, {
        title: sessionTitle,
        password: sessionPassword || undefined,
        allowGuestMode,
      });
      const success = await connectToSession(response.session.id);
      if (!success) throw new Error('서버 연결에 실패했습니다');

      setCurrentUserId(user.id);
      setSession({
        id: response.session.id,
        code: response.session.code,
        title: sessionTitle,
        status: SessionStatus.Active,
        hostId: user.id,
        participants: [{
          userId: user.id,
          userName: user.name,
          role: ParticipantRole.Host,
          joinedAt: Date.now(),
          isMuted: false,
          isSpeaking: false,
        }],
        createdAt: Date.now(),
        hasPassword: response.session.hasPassword,
        inviteToken: response.session.inviteToken,
      });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.status === 401) {
          setCreateError('로그인이 만료되었습니다. 다시 로그인해주세요.');
          setTimeout(() => navigate('/login', { replace: true }), 1500);
          return;
        }
        if (error.status >= 500) {
          setCreateError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          return;
        }
      }
      const msg = error instanceof Error ? error.message : '';
      if (msg === '서버 연결에 실패했습니다') {
        setCreateError('세션이 생성되었지만 서버 연결에 실패했습니다. 다시 시도해주세요.');
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        setCreateError('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
      } else {
        setCreateError(msg || '세션 생성에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsCreating(false);
    }
  }, [sessionTitle, sessionPassword, allowGuestMode, tokens, user, serverUrl]);

  const handleJoin = useCallback(async () => {
    if (!joinCode) {
      setJoinCodeError('세션 코드를 입력해주세요');
      codeInputRef.current?.focus();
      return;
    }
    if (joinCode.length !== 6) {
      setJoinCodeError('6자리 코드를 입력해주세요');
      codeInputRef.current?.focus();
      return;
    }
    if (joinPassword && joinPassword.length !== 6) {
      setJoinPasswordError('비밀번호는 6자리로 입력해주세요');
      return;
    }
    if (!tokens?.accessToken || !user) return;

    setIsJoining(true);
    setJoinError(null);
    setJoinCodeError(null);
    setJoinPasswordError(null);

    try {
      if (import.meta.env.DEV) {
        const devSession = devBridge.getSession(joinCode);
        if (devSession) {
          const guestId = 'guest-' + Math.random().toString(36).slice(2, 9);
          setCurrentUserId(guestId);
          setSession({
            id: devSession.id,
            code: devSession.code,
            status: SessionStatus.Active,
            hostId: devSession.hostId,
            participants: [{
              userId: guestId,
              userName: user.name,
              role: ParticipantRole.Guest,
              joinedAt: Date.now(),
              isMuted: false,
              isSpeaking: false,
            }],
            createdAt: devSession.createdAt,
            hasPassword: false,
          });
          devBridge.send({ type: 'GUEST_JOIN', userId: guestId, userName: user.name, code: devSession.code });
          setIsJoining(false);
          return;
        }
      }

      const response = await sessionService.joinSession(
        tokens.accessToken,
        joinCode,
        { password: joinPassword || undefined }
      );
      const success = await connectToSession(response.session.id);
      if (!success) throw new Error('서버 연결에 실패했습니다');

      setCurrentUserId(user.id);
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
        hasPassword: response.session.hasPassword,
      });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        switch (error.status) {
          case 404:
            setJoinCodeError('존재하지 않는 세션입니다. 코드를 다시 확인해주세요.');
            return;
          case 410:
            setJoinCodeError('이미 종료된 세션입니다.');
            return;
          case 401:
            if (error.code === 'INVALID_PASSWORD') {
              setJoinPasswordError('비밀번호가 올바르지 않습니다.');
            } else {
              setJoinError('로그인이 만료되었습니다. 다시 로그인해주세요.');
              setTimeout(() => navigate('/login', { replace: true }), 1500);
            }
            return;
          case 403:
            if (error.code === 'GUEST_NOT_ALLOWED') {
              setJoinError('이 세션은 게스트 참여가 허용되지 않습니다.');
            } else if (error.code === 'SESSION_FULL') {
              setJoinError('세션 정원이 가득 찼습니다.');
            } else {
              setJoinError('세션에 참여할 수 없습니다.');
            }
            return;
          case 409:
            setJoinError('이미 참여 중인 세션입니다.');
            return;
          default:
            if (error.status >= 500) {
              setJoinError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
              return;
            }
        }
      }
      const msg = error instanceof Error ? error.message : '';
      if (msg === '서버 연결에 실패했습니다') {
        setJoinError('세션에 참여했지만 서버 연결에 실패했습니다. 다시 시도해주세요.');
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        setJoinError('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
      } else {
        setJoinError(msg || '참가에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsJoining(false);
    }
  }, [joinCode, joinPassword, tokens, user, serverUrl]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setTitleError(null);
    setPasswordError(null);
    setCreateError(null);
    setJoinCodeError(null);
    setJoinPasswordError(null);
    setJoinError(null);
    setTimeout(() => {
      if (m === 'create') titleInputRef.current?.focus();
      else codeInputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-5 gap-0 neo-card overflow-hidden">

        {/* ── 좌측 패널 ── */}
        <div className="hidden lg:flex lg:col-span-2 flex-col justify-center px-10 py-12 bg-[#f5f3ff] border-r border-[#fff1e6] gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-400">환영합니다!</p>
            <p className="text-xl font-bold text-gray-800 leading-snug">새로운 세션을 시작하거나,</p>
            <p className="text-sm text-gray-500">초대받은 세션에 참여해보세요.</p>
          </div>

          <div className="flex flex-col gap-2">
            {/* 새 세션 생성 */}
            <button
              onClick={() => switchMode('create')}
              className={`flex items-start gap-3 p-4 rounded-2xl text-left transition-all ${
                mode === 'create'
                  ? 'bg-white border border-blue-200 shadow-sm'
                  : 'hover:bg-white border border-transparent'
              }`}
            >
              <span className={`w-8 h-8 rounded-full text-base font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                mode === 'create' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                +
              </span>
              <div>
                <p className={`font-semibold text-sm ${mode === 'create' ? 'text-gray-800' : 'text-gray-600'}`}>
                  새 세션 생성
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">호스트가 되어 수업이나 회의를 시작하세요.</p>
              </div>
            </button>

            {/* 참여하기 */}
            <button
              onClick={() => switchMode('join')}
              className={`flex items-start gap-3 p-4 rounded-2xl text-left transition-all ${
                mode === 'join'
                  ? 'bg-white border border-blue-200 shadow-sm'
                  : 'hover:bg-white border border-transparent'
              }`}
            >
              <span className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                mode === 'join' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                G
              </span>
              <div>
                <p className={`font-semibold text-sm ${mode === 'join' ? 'text-gray-800' : 'text-gray-600'}`}>
                  참여하기
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">공유받은 세션 코드를 입력하여 참여하세요.</p>
              </div>
            </button>
          </div>
        </div>

        {/* ── 우측 폼 영역 ── */}
        <div className="lg:col-span-3 p-8 sm:p-10 flex flex-col justify-center">

          {mode === 'create' ? (
            /* ══ 생성 폼 ══ */
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-bold text-gray-800 text-center">NeoCAST Session</h2>

              {/* 세션명 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  세션명 <span className="text-red-500">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={sessionTitle}
                  onChange={e => {
                    const val = e.target.value.slice(0, 30);
                    setSessionTitle(val);
                    setTitleError(null);
                  }}
                  placeholder="세션명을 입력해주세요"
                  maxLength={30}
                  className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                    titleError ? 'border-red-400' : 'border-gray-200'
                  }`}
                  disabled={isCreating}
                />
                <div className="mt-1 flex items-center justify-between">
                  {titleError
                    ? <p className="text-xs text-red-500">{titleError}</p>
                    : <span />
                  }
                  <p className={`text-xs ml-auto ${sessionTitle.length >= 30 ? 'text-red-400' : 'text-gray-400'}`}>
                    {sessionTitle.length}/30
                  </p>
                </div>
              </div>

              {/* 세션 비밀번호 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">세션 비밀번호</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sessionPassword}
                    onChange={e => {
                      const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
                      setSessionPassword(val);
                      setPasswordError(null);
                    }}
                    className={`flex-1 px-4 py-3 bg-white border rounded-xl font-mono tracking-widest text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                      passwordError ? 'border-red-400' : 'border-gray-200'
                    }`}
                    maxLength={6}
                    disabled={isCreating}
                  />
                  <button
                    onClick={() => { setSessionPassword(generatePassword()); setPasswordError(null); }}
                    disabled={isCreating}
                    className="px-3 py-3 bg-white border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 hover:text-gray-700 transition-colors text-sm flex-shrink-0"
                    title="비밀번호 재생성"
                  >
                    ↺
                  </button>
                </div>
                {passwordError
                  ? <p className="mt-1 text-xs text-red-500">{passwordError}</p>
                  : <p className="mt-1 text-xs text-gray-400">자동 생성된 비밀번호입니다. 직접 수정하거나 ↺로 재생성할 수 있습니다.</p>
                }
              </div>

              {/* 게스트 모드 */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowGuestMode}
                  onChange={e => setAllowGuestMode(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                  disabled={isCreating}
                />
                <span className="text-sm text-gray-700">게스트 모드 허용</span>
              </label>

              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                  {createError}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full neo-btn-primary py-3 mt-1 disabled:opacity-50"
              >
                {isCreating ? '생성 중...' : '생성하기'}
              </button>
            </div>

          ) : (
            /* ══ 참가 폼 ══ */
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-bold text-gray-800 text-center">NeoCAST Session</h2>

              {/* 세션 코드 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  세션 코드 <span className="text-red-500">*</span>
                </label>
                <input
                  ref={codeInputRef}
                  type="text"
                  value={joinCode}
                  onChange={e => {
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                    setJoinCodeError(null);
                  }}
                  placeholder="6자리 코드 입력"
                  className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-center text-2xl tracking-widest uppercase transition-all ${
                    joinCodeError ? 'border-red-400' : 'border-gray-200'
                  }`}
                  maxLength={6}
                  disabled={isJoining}
                />
                {joinCodeError && <p className="mt-1 text-xs text-red-500">{joinCodeError}</p>}
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  세션 비밀번호 <span className="text-xs text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  type="text"
                  value={joinPassword}
                  onChange={e => {
                    const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
                    setJoinPassword(val);
                    setJoinPasswordError(null);
                  }}
                  placeholder="6자리 비밀번호"
                  className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono tracking-widest text-center transition-all ${
                    joinPasswordError ? 'border-red-400' : 'border-gray-200'
                  }`}
                  maxLength={6}
                  disabled={isJoining}
                />
                {joinPasswordError
                  ? <p className="mt-1 text-xs text-red-500">{joinPasswordError}</p>
                  : <p className="mt-1 text-xs text-gray-400">호스트가 비밀번호를 설정한 경우 입력하세요.</p>
                }
              </div>

              {joinError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                  {joinError}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full neo-btn-primary py-3 mt-1 disabled:opacity-50"
              >
                {isJoining ? '참가 중...' : '참가하기'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
