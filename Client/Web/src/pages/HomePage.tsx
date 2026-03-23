import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface EndedSession {
  sessionId: string;
  title: string;
  sessionCode?: string;
  participantCount: number;
  endedAt: string;
}

interface ArchiveItem {
  archiveId: string;
  sessionName: string;
  participantCount: number;
  endedAt: string;
  pages: number;
}

const DUMMY_ENDED_SESSIONS: EndedSession[] = [
  {
    sessionId: 'test-001',
    title: '수학 월요일 오전반',
    participantCount: 5,
    endedAt: '2026-03-23T10:30:00',
  },
  {
    sessionId: 'test-002',
    title: '영어 화요일 저녁반',
    participantCount: 8,
    endedAt: '2026-03-22T18:00:00',
  },
  {
    sessionId: 'test-003',
    title: '국어 수요일 오후반',
    participantCount: 12,
    endedAt: '2026-03-21T14:00:00',
  },
];

const DUMMY_ARCHIVES: ArchiveItem[] = [
  {
    archiveId: 'archive_001',
    sessionName: '중학교 수학 - 이차방정식',
    participantCount: 12,
    endedAt: '2026-03-10T15:30:00',
    pages: 3,
  },
  {
    archiveId: 'archive_002',
    sessionName: '고등 국어 - 현대시 분석',
    participantCount: 8,
    endedAt: '2026-03-07T11:00:00',
    pages: 2,
  },
  {
    archiveId: 'archive_003',
    sessionName: '이차방정식 문제풀이',
    participantCount: 6,
    endedAt: '2026-03-21T16:30:00',
    pages: 3,
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function HomePage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('선생님');
  const [endedSessions, setEndedSessions] = useState<EndedSession[]>([]);
  const [archives, setArchives] = useState<ArchiveItem[]>([]);

  useEffect(() => {
    // 인증 정보 로드
    try {
      const auth = JSON.parse(localStorage.getItem('nc_auth') || '{}');
      if (auth.nickname) setNickname(auth.nickname);
    } catch {}

    // 종료된 세션 로드 (없으면 더미 데이터 사용)
    try {
      const saved = localStorage.getItem('nc_ended_sessions');
      if (saved) {
        setEndedSessions(JSON.parse(saved));
      } else {
        setEndedSessions(DUMMY_ENDED_SESSIONS);
      }
    } catch {}

    // 아카이브 초기화 (항상 더미 데이터를 기본값으로 병합)
    try {
      const saved = localStorage.getItem('nc_archives');
      if (saved) {
        const existing = JSON.parse(saved) as ArchiveItem[];
        // 더미 데이터의 세션명이 변경되었을 수 있으므로 병합
        const merged = DUMMY_ARCHIVES.map(dummy => {
          const found = existing.find(e => e.archiveId === dummy.archiveId);
          return found ? { ...found, sessionName: dummy.sessionName } : dummy;
        });
        // 더미에 없는 사용자 추가 아카이브도 유지
        const userAdded = existing.filter(e => !DUMMY_ARCHIVES.some(d => d.archiveId === e.archiveId));
        const finalArchives = [...merged, ...userAdded];
        localStorage.setItem('nc_archives', JSON.stringify(finalArchives));
        setArchives(finalArchives);
      } else {
        localStorage.setItem('nc_archives', JSON.stringify(DUMMY_ARCHIVES));
        setArchives(DUMMY_ARCHIVES);
      }
    } catch {
      setArchives(DUMMY_ARCHIVES);
    }
  }, []);

  // 종료된 세션 → 아카이브로 저장
  const handleSaveToArchive = (session: EndedSession) => {
    const newArchive: ArchiveItem = {
      archiveId: `archive_${session.sessionId}`,
      sessionName: session.title,
      participantCount: session.participantCount,
      endedAt: session.endedAt,
      pages: 0,
    };

    const updatedArchives = [newArchive, ...archives];
    setArchives(updatedArchives);
    localStorage.setItem('nc_archives', JSON.stringify(updatedArchives));

    // 종료된 세션 목록에서 제거
    const updatedEnded = endedSessions.filter(s => s.sessionId !== session.sessionId);
    setEndedSessions(updatedEnded);
    localStorage.setItem('nc_ended_sessions', JSON.stringify(updatedEnded));
  };

  // 종료된 세션 삭제 (아카이브 저장 안 함)
  const handleDismissEnded = (sessionId: string) => {
    const updatedEnded = endedSessions.filter(s => s.sessionId !== sessionId);
    setEndedSessions(updatedEnded);
    localStorage.setItem('nc_ended_sessions', JSON.stringify(updatedEnded));
  };

  return (
    <div className="min-h-screen relative bg-app-bg">
      {/* 본문 */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10">
        {/* 인사말 */}
        <h1 className="text-2xl font-bold text-gray-800">
          안녕하세요, {nickname}님!
        </h1>

        {/* 새 세션 시작 카드 */}
        <button
          onClick={() => navigate('/session/create')}
          className="w-full neo-card p-6 flex items-center gap-4 hover:shadow-lg transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center text-white text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
            +
          </div>
          <div>
            <p className="font-bold text-gray-800 text-base">새 세션 시작</p>
            <p className="text-sm text-gray-500 mt-0.5">지금 바로 수업을 시작하세요</p>
          </div>
        </button>

        {/* 종료된 세션 (아카이브 저장 대기) */}
        {endedSessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-gray-700">종료된 세션</h2>
            <div className="flex flex-col gap-2">
              {endedSessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="neo-card px-6 py-4 flex items-center justify-between"
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="font-medium text-gray-800 text-sm truncate">
                      {session.title}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{session.participantCount}명 참여</span>
                      <span>{formatDateTime(session.endedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <button
                      onClick={() => handleSaveToArchive(session)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      아카이브 저장
                    </button>
                    <button
                      onClick={() => handleDismissEnded(session.sessionId)}
                      className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-400 text-xs font-medium hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 아카이브 목록 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-700">아카이브</h2>

          {archives.length === 0 ? (
            <div className="neo-card p-8 text-center text-gray-400 text-sm">
              저장된 아카이브가 없습니다
            </div>
          ) : (
            <div className="neo-card overflow-hidden">
              {archives.map((item, idx) => (
                <button
                  key={item.archiveId}
                  onClick={() => navigate(`/archive/${item.archiveId}`)}
                  className={`w-full flex items-center justify-between px-6 py-4 hover:bg-blue-50/60 transition-colors text-left ${
                    idx !== archives.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-gray-800 text-sm">{item.sessionName}</span>
                    <span className="text-xs text-gray-400">{formatDate(item.endedAt)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{item.participantCount}명</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
