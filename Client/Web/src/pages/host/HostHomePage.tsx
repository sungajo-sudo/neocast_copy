import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { sessionService, type HostSessionItem } from '../../services/session-service';
import { CreateSessionModal } from '../../components/host/CreateSessionModal';

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case 'ACTIVE':  return { text: '진행중', className: 'bg-green-100 text-green-700' };
    case 'CLOSED':  return { text: '종료', className: 'bg-gray-100 text-gray-500' };
    case 'PAUSED':  return { text: '일시정지', className: 'bg-yellow-100 text-yellow-700' };
    default:        return { text: status, className: 'bg-gray-100 text-gray-500' };
  }
}

// 오늘/예정 필터
type SessionFilter = 'today' | 'upcoming';

function filterSessions(sessions: HostSessionItem[], filter: SessionFilter): HostSessionItem[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  if (filter === 'today') {
    return sessions.filter((s) => {
      const d = new Date(s.scheduledAt ?? s.createdAt);
      return d >= todayStart && d < todayEnd;
    });
  }
  // upcoming: 아직 종료되지 않은 세션 (미래 예정 포함)
  return sessions.filter((s) => {
    if (s.status === 'ACTIVE') return true;
    const d = new Date(s.scheduledAt ?? s.createdAt);
    return d >= now && s.status !== 'CLOSED';
  });
}

// 개발 환경 더미 데이터
const DEV_MOCK_SESSIONS: HostSessionItem[] = [
  {
    id: 'mock-1',
    code: 'ABC123',
    title: '수학 기초 1강',
    status: 'ACTIVE',
    scheduledAt: new Date().toISOString(),
    expectedParticipants: 10,
    createdAt: new Date().toISOString(),
    closedAt: null,
    hasPassword: true,
    allowGuestMode: true,
    participantCount: 7,
  },
  {
    id: 'mock-2',
    code: 'XYZ789',
    title: '영어 회화 중급',
    status: 'CLOSED',
    scheduledAt: new Date(Date.now() - 86400000).toISOString(),
    expectedParticipants: 8,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    closedAt: new Date(Date.now() - 80000000).toISOString(),
    hasPassword: false,
    allowGuestMode: true,
    participantCount: 6,
  },
  {
    id: 'mock-3',
    code: 'DEF456',
    title: '과학 실험 개요',
    status: 'CLOSED',
    scheduledAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    expectedParticipants: 15,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    closedAt: new Date(Date.now() - 1.9 * 86400000).toISOString(),
    hasPassword: true,
    allowGuestMode: false,
    participantCount: 12,
  },
];

// ─────────────────────────────────────────
// HostHomePage
// ─────────────────────────────────────────

export function HostHomePage() {
  const navigate = useNavigate();
  const { user, tokens } = useAuthStore();

  const [sessions, setSessions] = useState<HostSessionItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('today');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 세션 목록 로드
  useEffect(() => {
    const load = async () => {
      setIsLoadingSessions(true);
      try {
        const res = await sessionService.getHostSessions(tokens?.accessToken ?? '');
        setSessions(res.sessions);
      } catch {
        // 백엔드 미실행 시 mock 데이터
        if (import.meta.env.DEV) {
          setSessions(DEV_MOCK_SESSIONS);
        }
      } finally {
        setIsLoadingSessions(false);
      }
    };
    load();
  }, [tokens]);

  // 대시보드 요약 계산
  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;
  const closedSessions = sessions.filter((s) => s.status === 'CLOSED');
  const avgParticipation =
    closedSessions.length > 0
      ? Math.round(
          closedSessions.reduce((sum, s) => {
            const rate = s.expectedParticipants
              ? (s.participantCount / s.expectedParticipants) * 100
              : 0;
            return sum + rate;
          }, 0) / closedSessions.length
        )
      : 0;

  // 필터링된 세션 (최대 5개)
  const filteredSessions = filterSessions(sessions, sessionFilter).slice(0, 5);

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ─── 상단 인사 영역 ─── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {user?.name ?? '선생님'}님!
        </h1>
        <p className="text-gray-500 mt-1">오늘도 스마트한 수업을 시작해볼까요?</p>
      </div>

      {/* ─── 2컬럼 카드 영역 ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

        {/* 좌측: 새 세션 시작 카드 */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex flex-col items-center justify-center gap-3 p-8 bg-white border-2 border-dashed border-blue-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
            <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-800">새 세션 시작</p>
            <p className="text-sm text-gray-500 mt-1">
              즉시 수업을 시작하거나 교재를 업로드하여<br />세션을 준비하세요
            </p>
          </div>
        </button>

        {/* 우측: 요약 대시보드 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">요약 대시보드</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">진행 중인 세션</span>
                <span className="text-lg font-bold text-blue-600">{activeSessions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">전체 세션</span>
                <span className="text-lg font-bold text-gray-800">{totalSessions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">평균 참여도</span>
                <span className="text-lg font-bold text-green-600">{avgParticipation}%</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/host/results')}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
          >
            상세 학습 데이터 리포트 보기
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── 세션 목록 영역 ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">세션 목록</h2>
          {/* 필터 탭 */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['today', 'upcoming'] as SessionFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSessionFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  sessionFilter === f
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'today' ? '오늘' : '예정된 세션'}
              </button>
            ))}
          </div>
        </div>

        {/* 세션 리스트 */}
        {isLoadingSessions ? (
          <div className="py-12 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-400 text-sm">해당하는 세션이 없습니다.</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              새 세션 만들기
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filteredSessions.map((s) => {
              const badge = statusLabel(s.status);
              return (
                <li key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                  {/* 시간 */}
                  <div className="w-24 flex-shrink-0 text-xs text-gray-400">
                    {formatDate(s.scheduledAt ?? s.createdAt)}
                  </div>

                  {/* 제목 + 뱃지 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {s.title || `세션 ${s.code}`}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      참가자 {s.participantCount}명
                      {s.expectedParticipants ? ` / 예정 ${s.expectedParticipants}명` : ''}
                      {' · '}코드: {s.code}
                    </p>
                  </div>

                  {/* 시작 버튼 */}
                  {s.status !== 'CLOSED' && (
                    <button
                      type="button"
                      onClick={() => navigate(`/session/${s.code}`)}
                      className="flex-shrink-0 px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {s.status === 'ACTIVE' ? '입장' : '시작'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 세션 만들기 모달 */}
      <CreateSessionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
