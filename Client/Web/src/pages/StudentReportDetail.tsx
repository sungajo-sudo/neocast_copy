import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import watercolorBg from '../assets/images/watercolor-bg.png';

// ─── 더미 데이터 ────────────────────────────────────────────────

const TOTAL_PAGES = 5;

const DUMMY_PARTICIPANTS = [
  { userId: 'host_001', nickname: '김선생', role: 'host' },
  { userId: 'guest_001', nickname: '박민준', role: 'guest' },
  { userId: 'guest_002', nickname: '이서연', role: 'guest' },
  { userId: 'guest_003', nickname: '최도윤', role: 'guest' },
  { userId: 'guest_004', nickname: '정하은', role: 'guest' },
  { userId: 'guest_005', nickname: '강지우', role: 'guest' },
];

const DUMMY_FEEDBACKS = [
  { page: 2, text: '이 부분 수식 다시 확인해보세요', time: '12:34' },
  { page: 4, text: '잘 정리했어요, 계속 이렇게!', time: '31:07' },
];

const DUMMY_PAGE_STATS = [
  { page: 1, minutes: 8, strokes: 24, feedback: 0 },
  { page: 2, minutes: 12, strokes: 36, feedback: 1 },
  { page: 3, minutes: 15, strokes: 42, feedback: 0 },
  { page: 4, minutes: 7, strokes: 18, feedback: 1 },
  { page: 5, minutes: 3, strokes: 8, feedback: 0 },
];

const TOTAL_DURATION_MS = 75 * 1000; // 1분 15초 (더미)

// 호스트 버전 B용 페이지별 더미 데이터
const HOST_PAGE_STATS = [
  { page: 1, minutes: 8,  hasFeedback: false },
  { page: 2, minutes: 12, hasFeedback: true  },
  { page: 3, minutes: 15, hasFeedback: false },
  { page: 4, minutes: 7,  hasFeedback: true  },
  { page: 5, minutes: 3,  hasFeedback: false },
];

// ─── 유틸 ─────────────────────────────────────────────────────

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fillBlankCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
}

// ─── 컴포넌트 ─────────────────────────────────────────────────

export function StudentReportDetail() {
  const { archiveId, userId } = useParams<{ archiveId: string; userId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get('role') === 'host';

  const participant = DUMMY_PARTICIPANTS.find(p => p.userId === userId) ?? DUMMY_PARTICIPANTS[1];

  // 재생 상태 (UI only)
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 캔버스 — 흰 배경만 (실제 데이터 삽입 예정)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    fillBlankCanvas(ctx, canvas.width, canvas.height);
  }, [currentPage]);

  // 페이지 이동 시 타임라인 리셋
  const goToPage = (p: number) => {
    setCurrentPage(p);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentTime(ratio * TOTAL_DURATION_MS);
  };

  const progress = currentTime / TOTAL_DURATION_MS;
  const activePageStats = DUMMY_PAGE_STATS.find(s => s.page === currentPage);

  return (
    <div className="min-h-screen relative">
      {/* 배경 — 호스트: 단색 연파랑 / 게스트: 수채화 */}
      {isHost ? (
        <div className="fixed inset-0 z-0 bg-[#dce9f8]" />
      ) : (
        <>
          <div
            className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
            style={{ backgroundImage: `url(${watercolorBg})` }}
          />
          <div className="fixed inset-0 z-0 bg-white/40 pointer-events-none" />
        </>
      )}

      {/* ─── 2-A. 상단 네비게이션 바 ─── */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/50 h-14 flex items-center px-6">
        <button
          onClick={() => navigate(`/archive/${archiveId}`)}
          className="text-gray-600 hover:text-gray-900 text-sm transition-colors flex-shrink-0"
        >
          ← 뒤로가기
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-800 text-base truncate">
          {participant.nickname}의 필기 상세
        </h1>
        <span className="w-20 flex-shrink-0" />
      </header>

      {/* ══ 버전 B: 호스트 진입 — 페이지 그리드 + 사이드 패널 ══ */}
      {isHost ? (
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          <div className="flex gap-5 items-start">

            {/* ── 좌측 70%: 페이지 그리드 ── */}
            <div className="flex-[7] bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-5">
              <p className="text-sm font-semibold text-gray-600 mb-4">전체 페이지</p>
              <div className="grid grid-cols-3 gap-3">
                {HOST_PAGE_STATS.map(pg => (
                  <button
                    key={pg.page}
                    onClick={() => goToPage(pg.page)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all hover:shadow-md ${
                      currentPage === pg.page
                        ? 'border-blue-500 shadow-md'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    {/* 빈 캔버스 (A4 비율) */}
                    <div className="bg-white w-full" style={{ aspectRatio: '210/297' }} />
                    {/* 첨삭 뱃지 */}
                    {pg.hasFeedback && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">✓</span>
                      </span>
                    )}
                    {/* 페이지 번호 */}
                    <div className={`px-2 py-1.5 flex items-center justify-center gap-1.5 ${
                      currentPage === pg.page ? 'bg-blue-50' : 'bg-gray-50'
                    }`}>
                      <span className={`text-xs font-semibold ${
                        currentPage === pg.page ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {pg.page}P
                      </span>
                      {currentPage === pg.page && (
                        <span className="text-[9px] text-blue-400">● 선택</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── 우측 30%: 선택된 페이지 상세 패널 ── */}
            <div className="flex-[3] bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-5 flex flex-col gap-4 sticky top-20">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{currentPage}P 상세</p>
                {HOST_PAGE_STATS.find(p => p.page === currentPage)?.hasFeedback && (
                  <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">첨삭 있음</span>
                )}
              </div>

              {/* 선택 페이지 캔버스 */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden w-full" style={{ aspectRatio: '210/297' }} />

              {/* Seek bar */}
              <div className="flex flex-col gap-1.5">
                <div
                  className="relative h-1.5 bg-gray-200 rounded-full cursor-pointer"
                  onClick={handleSeek}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-300 rounded-full transition-all"
                    style={{ width: `${progress * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full shadow transition-all"
                    style={{ left: `calc(${progress * 100}% - 6px)` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(TOTAL_DURATION_MS)}</span>
                </div>
              </div>

              {/* 재생 컨트롤 */}
              <div className="flex items-center justify-center gap-2">
                {/* 배속 */}
                <button
                  onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors min-w-[38px] text-center"
                >
                  {speed}x
                </button>
                {/* -10초 */}
                <button
                  onClick={() => setCurrentTime(t => Math.max(0, t - 10000))}
                  className="w-9 h-9 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center text-xs font-medium"
                >
                  −10
                </button>
                {/* 재생/일시정지 */}
                <button
                  onClick={() => setIsPlaying(v => !v)}
                  className="w-10 h-10 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center text-base"
                >
                  {isPlaying ? '⏸' : '▷'}
                </button>
                {/* +10초 */}
                <button
                  onClick={() => setCurrentTime(t => Math.min(TOTAL_DURATION_MS, t + 10000))}
                  className="w-9 h-9 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center text-xs font-medium"
                >
                  +10
                </button>
              </div>
            </div>

          </div>
        </div>

      ) : (

      /* ══ 버전 A: 게스트(학생) 진입 — 기존 전체 레이아웃 ══ */
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* ─── 요약 카드 3개 ─── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '활동 시간', value: '15분', color: 'text-blue-600' },
            { label: '참여 페이지', value: '3 / 5', color: 'text-purple-600' },
            { label: '받은 첨삭 수', value: '2회', color: 'text-green-600' },
          ].map(card => (
            <div
              key={card.label}
              className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow p-5 flex flex-col gap-1"
            >
              <span className="text-xs text-gray-500">{card.label}</span>
              <span className={`text-2xl font-bold ${card.color}`}>{card.value}</span>
            </div>
          ))}
        </div>

        {/* ─── 필기 재생 플레이어 ─── */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
          <div className="flex gap-0">
            {/* ─── 캔버스 영역 ─── */}
            <div className="flex-1 flex flex-col items-center p-5 gap-4 border-r border-gray-100">
              <div className="w-full max-w-xs bg-white rounded-xl shadow-inner border border-gray-100 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={990}
                  className="block w-full"
                  style={{ aspectRatio: '700 / 990' }}
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all">← 이전</button>
                <span className="text-sm text-gray-600 font-medium tabular-nums min-w-[60px] text-center">{currentPage} / {TOTAL_PAGES}</span>
                <button onClick={() => goToPage(Math.min(TOTAL_PAGES, currentPage + 1))} disabled={currentPage === TOTAL_PAGES} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all">다음 →</button>
              </div>
            </div>

            {/* ─── 우측 컨트롤 패널 ─── */}
            <div className="w-60 flex-shrink-0 flex flex-col gap-5 p-6 justify-center">
              <div className="flex flex-col gap-2">
                <button onClick={() => setIsPlaying(v => !v)} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:opacity-90 active:scale-95 transition-all shadow-md">
                  {isPlaying ? '⏸ 일시정지' : '▶ 실시간기록'}
                </button>
                <button onClick={handleReset} className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 active:scale-95 transition-all">○ 처음으로</button>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-gray-500">재생 속도</span>
                <div className="flex gap-1.5">
                  {([0.5, 1, 2] as const).map(s => (
                    <button key={s} onClick={() => setSpeed(s)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${speed === s ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{s}x</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-gray-500">타임라인</span>
                <div className="relative h-2 bg-gray-200 rounded-full cursor-pointer" onClick={handleSeek}>
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: `${progress * 100}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full shadow" style={{ left: `calc(${progress * 100}% - 7px)` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(TOTAL_DURATION_MS)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── 하단 통계 바 ─── */}
          <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex items-center gap-4 text-sm text-gray-600 flex-wrap">
            <span className="font-medium text-gray-800">{participant.nickname}</span>
            <span className="text-gray-300">·</span>
            <span>참여 <strong className="text-gray-800">3</strong> / {TOTAL_PAGES} 페이지</span>
            <span className="text-gray-300">·</span>
            <span>현재 <strong className="text-gray-800">{currentPage}P</strong> / {TOTAL_PAGES}P</span>
            <span className="text-gray-300">·</span>
            <span className="tabular-nums">{formatTime(currentTime)} / {formatTime(TOTAL_DURATION_MS)}</span>
            {activePageStats && (
              <>
                <span className="text-gray-300">·</span>
                <span>스트로크 <strong className="text-gray-800">{activePageStats.strokes}</strong>개</span>
              </>
            )}
          </div>
        </div>

        {/* ─── 피드백 다시보기 ─── */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-6 flex flex-col gap-4">
          <h2 className="font-bold text-gray-800 text-base">피드백 다시보기</h2>
          <p className="text-sm text-gray-500">
            {DUMMY_FEEDBACKS.length}페이지에 첨삭이 있어요
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {DUMMY_FEEDBACKS.map((fb, i) => (
              <button
                key={i}
                onClick={() => goToPage(fb.page)}
                className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-100 transition-colors"
              >
                {fb.page}P
              </button>
            ))}
          </div>
        </div>

        {/* ─── 페이지 참여 요약 표 ─── */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-base">페이지 참여 요약</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">페이지</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">필기 시간</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">첨삭</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {DUMMY_PAGE_STATS.map(row => (
                  <tr
                    key={row.page}
                    onClick={() => goToPage(row.page)}
                    className={`cursor-pointer transition-colors ${row.page === currentPage ? 'bg-blue-50/60' : 'hover:bg-gray-50/60'}`}
                  >
                    <td className="px-6 py-3 font-medium text-gray-800">
                      {row.page}P
                      {row.page === currentPage && (
                        <span className="ml-2 text-xs text-blue-500">● 현재</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{row.minutes}분</td>
                    <td className="px-6 py-3">
                      {row.feedback > 0
                        ? <span className="font-bold text-blue-600">✓</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      )}
    </div>
  );
}
