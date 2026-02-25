import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { useSessionStore } from '../../stores/session-store';
import { useConnectionStore } from '../../stores/connection-store';
import { sessionService } from '../../services/session-service';
import { SessionStatus, ParticipantRole } from '../../types';
import { devBridge } from '../../services/dev-bridge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** 6자리 랜덤 비밀번호 생성 */
function generatePassword(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 세션 만들기 모달
 * 필드: 수업 제목(필수), 날짜/시간, 워크시트 업로드, 참가 예정 인원(필수),
 *       세션 비밀번호(자동생성), 게스트 모드 허용
 */
export function CreateSessionModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const { user, tokens } = useAuthStore();
  const setSession = useSessionStore((state) => state.setSession);
  const setCurrentUserId = useSessionStore((state) => state.setCurrentUserId);
  const { connect, serverUrl } = useConnectionStore();

  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [expectedParticipants, setExpectedParticipants] = useState('');
  const [password, setPassword] = useState(generatePassword);
  const [allowGuestMode, setAllowGuestMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모달이 열릴 때마다 비밀번호 새로 생성
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setScheduledAt('');
      setExpectedParticipants('');
      setPassword(generatePassword());
      setAllowGuestMode(true);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('수업 제목을 입력해주세요.');
      return;
    }
    const participants = parseInt(expectedParticipants, 10);
    if (!expectedParticipants || isNaN(participants) || participants < 1) {
      setError('참가 예정 인원 수를 1명 이상 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. REST API로 세션 생성
      const result = await sessionService.createSession(tokens?.accessToken ?? '', {
        title: title.trim(),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        expectedParticipants: participants,
        password,
        allowGuestMode,
      });

      const sess = result.session;

      // 2. 소켓 연결
      const connected = await connect(serverUrl, tokens?.accessToken ?? '', sess.id);
      if (!connected) {
        throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      }

      // 3. 세션 스토어 업데이트
      const currentUser = user!;
      setCurrentUserId(currentUser.id);
      setSession({
        id: sess.id,
        code: sess.code,
        status: SessionStatus.Active,
        hostId: currentUser.id,
        participants: [
          {
            userId: currentUser.id,
            userName: currentUser.name,
            role: ParticipantRole.Host,
            joinedAt: Date.now(),
            isMuted: false,
            isSpeaking: false,
          },
        ],
        createdAt: Date.now(),
        hasPassword: sess.hasPassword,
        inviteToken: sess.inviteToken,
      });

      navigate(`/session/${sess.code}`);
      onClose();
    } catch (err) {
      // DEV 모드: 백엔드 없이 Mock 세션으로 진입
      if (import.meta.env.DEV && user) {
        const mockCode = 'DEV' + Math.random().toString(36).slice(2, 5).toUpperCase();
        // DEV 브릿지에 세션 등록 (게스트 탭이 참가할 수 있도록)
        devBridge.announceSession({
          id: `mock-${mockCode}`,
          code: mockCode,
          title: title.trim(),
          hostId: user.id,
          hostName: user.name,
          createdAt: Date.now(),
        });
        setCurrentUserId(user.id);
        setSession({
          id: `mock-${mockCode}`,
          code: mockCode,
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
          hasPassword: !!password,
        });
        navigate(`/session/${mockCode}`);
        onClose();
        return;
      }
      setError(err instanceof Error ? err.message : '세션 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">새 세션 만들기</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* 수업 제목 (필수) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              수업 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 수학 기초 1강"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 날짜/시간 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              날짜/시간
              <span className="text-xs text-gray-400 font-normal ml-1">(미입력 시 현재 시간 기준)</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 참가 예정 인원 수 (필수) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              참가 예정 인원 수 <span className="text-red-500">*</span>
              <span className="text-xs text-gray-400 font-normal ml-1">(참여도 산출 기준)</span>
            </label>
            <input
              type="number"
              value={expectedParticipants}
              onChange={(e) => setExpectedParticipants(e.target.value)}
              placeholder="예) 10"
              min={1}
              max={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 세션 비밀번호 (자동생성) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              세션 비밀번호
              <span className="text-xs text-gray-400 font-normal ml-1">(자동 생성됨)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={password}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 font-mono tracking-widest"
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="px-3 py-2 text-xs text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                title="새로 생성"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* 게스트 모드 허용 */}
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              role="switch"
              aria-checked={allowGuestMode}
              onClick={() => setAllowGuestMode(!allowGuestMode)}
              className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${
                allowGuestMode ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${
                  allowGuestMode ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <div>
              <span className="text-sm font-medium text-gray-700">게스트 모드 허용</span>
              <p className="text-xs text-gray-400">비회원도 세션 코드로 참가할 수 있습니다</p>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? '생성 중...' : '세션 생성하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
