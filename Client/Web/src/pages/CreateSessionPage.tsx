import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useConnectionStore } from '../stores/connection-store';
import { useSessionStore } from '../stores/session-store';
import { sessionService, ApiRequestError } from '../services/session-service';
import { devBridge } from '../services/dev-bridge';
import { SessionStatus, ParticipantRole } from '../types';
import watercolorBg from '../assets/images/watercolor-bg.png';

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
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // 세션 참가 필드
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
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

  const handleCreate = useCallback(async () => {
    if (!sessionTitle.trim()) {
      setTitleError('세션명을 입력해주세요');
      titleInputRef.current?.focus();
      return;
    }
    if (!tokens?.accessToken || !user) return;

    setIsCreating(true);
    setCreateError(null);
    setTitleError(null);

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
      if (error instanceof ApiRequestError && error.status === 401) {
        devMockLogin('host');
        return;
      }
      setCreateError(error instanceof Error ? error.message : '세션 생성에 실패했습니다');
    } finally {
      setIsCreating(false);
    }
  }, [sessionTitle, sessionPassword, allowGuestMode, tokens, user, serverUrl]);

  const handleJoin = useCallback(async () => {
    if (joinCode.length !== 6) {
      setJoinError('6자리 세션 코드를 입력해주세요');
      return;
    }
    if (!tokens?.accessToken || !user) return;

    setIsJoining(true);
    setJoinError(null);

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
      setJoinError(error instanceof Error ? error.message : '참가에 실패했습니다');
    } finally {
      setIsJoining(false);
    }
  }, [joinCode, joinPassword, tokens, user, serverUrl]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setTitleError(null);
    setCreateError(null);
    setJoinError(null);
    setTimeout(() => {
      if (m === 'create') titleInputRef.current?.focus();
      else codeInputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* 수채화 배경 */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${watercolorBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-white/40 pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-5 gap-0 bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl overflow-hidden">

        {/* ── 좌측 스텝 인디케이터 ── */}
        <div className="hidden lg:flex lg:col-span-2 flex-col justify-center p-10 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-r border-white/40 gap-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">세션</p>

          {/* 스텝 1: 새 세션 만들기 */}
          <button
            onClick={() => switchMode('create')}
            className={`flex items-start gap-3 p-4 rounded-2xl text-left transition-all ${
              mode === 'create'
                ? 'bg-blue-50 border-2 border-blue-200 shadow-sm'
                : 'hover:bg-white/60 border-2 border-transparent'
            }`}
          >
            <span className={`w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
              mode === 'create' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              1
            </span>
            <div>
              <p className={`font-semibold text-sm ${mode === 'create' ? 'text-blue-700' : 'text-gray-600'}`}>
                새 세션 만들기
              </p>
              <p className="text-xs text-gray-400 mt-0.5">호스트로 수업을 시작하세요</p>
            </div>
          </button>

          {/* 스텝 2: 참여하기 */}
          <button
            onClick={() => switchMode('join')}
            className={`flex items-start gap-3 p-4 rounded-2xl text-left transition-all ${
              mode === 'join'
                ? 'bg-green-50 border-2 border-green-200 shadow-sm'
                : 'hover:bg-white/60 border-2 border-transparent'
            }`}
          >
            <span className={`w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
              mode === 'join' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </span>
            <div>
              <p className={`font-semibold text-sm ${mode === 'join' ? 'text-green-700' : 'text-gray-600'}`}>
                참여하기
              </p>
              <p className="text-xs text-gray-400 mt-0.5">코드를 입력해 참여하세요</p>
            </div>
          </button>
        </div>

        {/* ── 우측 폼 영역 ── */}
        <div className="lg:col-span-3 p-8 sm:p-10 flex flex-col justify-center">

          {mode === 'create' ? (
            /* ══ 생성 폼 ══ */
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-bold text-gray-800">새 세션 만들기</h2>

              {/* 세션명 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  세션명 <span className="text-red-500">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={sessionTitle}
                  onChange={e => { setSessionTitle(e.target.value); setTitleError(null); }}
                  placeholder="예: 수학 3-1반 2교시"
                  className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                    titleError ? 'border-red-400' : 'border-gray-200'
                  }`}
                  disabled={isCreating}
                />
                {titleError && <p className="mt-1 text-xs text-red-500">{titleError}</p>}
              </div>

              {/* 세션 비밀번호 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">세션 비밀번호</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono tracking-widest text-center text-gray-800 select-all">
                    {sessionPassword}
                  </div>
                  <button
                    onClick={() => setSessionPassword(generatePassword())}
                    disabled={isCreating}
                    className="px-3 py-3 bg-white border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 hover:text-gray-700 transition-colors text-sm flex-shrink-0"
                    title="비밀번호 재생성"
                  >
                    ↺
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">자동 생성된 비밀번호입니다. ↺로 재생성할 수 있습니다.</p>
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
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl py-3 font-semibold hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-md mt-1"
              >
                {isCreating ? '생성 중...' : '생성하기'}
              </button>
            </div>

          ) : (
            /* ══ 참가 폼 ══ */
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-bold text-gray-800">세션 참가하기</h2>

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
                    setJoinError(null);
                  }}
                  placeholder="6자리 코드 입력"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 font-mono text-center text-2xl tracking-widest uppercase transition-all"
                  maxLength={6}
                  disabled={isJoining}
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  비밀번호 <span className="text-xs text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  type="password"
                  value={joinPassword}
                  onChange={e => setJoinPassword(e.target.value)}
                  placeholder="세션 비밀번호"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  disabled={isJoining}
                />
              </div>

              {joinError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                  {joinError}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={isJoining || joinCode.length !== 6}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl py-3 font-semibold hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-md mt-1"
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
