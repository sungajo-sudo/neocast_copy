import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import watercolorBg from '../assets/images/watercolor-bg.png';

interface ArchiveItem {
  archiveId: string;
  sessionName: string;
  participantCount: number;
  endedAt: string;
  pages: number;
}

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
    sessionName: '영어 회화 중급반',
    participantCount: 15,
    endedAt: '2026-03-05T17:00:00',
    pages: 4,
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function HomePage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('선생님');
  const [archives, setArchives] = useState<ArchiveItem[]>([]);

  useEffect(() => {
    // 인증 정보 로드
    try {
      const auth = JSON.parse(localStorage.getItem('nc_auth') || '{}');
      if (auth.nickname) setNickname(auth.nickname);
    } catch {}

    // 아카이브 초기화
    try {
      const saved = localStorage.getItem('nc_archives');
      if (saved) {
        setArchives(JSON.parse(saved));
      } else {
        localStorage.setItem('nc_archives', JSON.stringify(DUMMY_ARCHIVES));
        setArchives(DUMMY_ARCHIVES);
      }
    } catch {
      setArchives(DUMMY_ARCHIVES);
    }
  }, []);

  return (
    <div className="min-h-screen relative">
      {/* 수채화 배경 */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${watercolorBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-white/40 pointer-events-none" />

      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/50 h-14 flex items-center px-6 justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Neo
          </span>
          <span className="text-xl font-bold text-gray-800">CAST</span>
        </div>
        <span className="text-sm text-gray-600 font-medium">{nickname}</span>
      </header>

      {/* 본문 */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">
        {/* 인사말 */}
        <h1 className="text-2xl font-bold text-gray-800">
          안녕하세요, {nickname}님!
        </h1>

        {/* 새 세션 시작 카드 */}
        <button
          onClick={() => navigate('/session/create')}
          className="w-full bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-6 flex items-center gap-4 hover:shadow-2xl hover:bg-white/90 transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
            +
          </div>
          <div>
            <p className="font-bold text-gray-800 text-base">새 세션 시작</p>
            <p className="text-sm text-gray-500 mt-0.5">지금 바로 수업을 시작하세요</p>
          </div>
        </button>

        {/* 지난 수업 기록 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-700">지난 수업 기록</h2>

          {archives.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-8 text-center text-gray-400 text-sm">
              아직 종료된 수업이 없습니다
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
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
