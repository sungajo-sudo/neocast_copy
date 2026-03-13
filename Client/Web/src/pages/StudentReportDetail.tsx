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

// ─── 유틸 ─────────────────────────────────────────────────────

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// 페이지+idx 기반 결정론적 seed rng
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function drawPageStrokes(
  ctx: CanvasRenderingContext2D,
  page: number,
  participantIdx: number
) {
  const W = 700, H = 990;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // 격자 선 (노트 배경)
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  for (let y = 60; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const rand = seededRand(page * 1000 + participantIdx * 137);
  const strokeCount = 4 + Math.floor(rand() * 4);

  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a1a2e';

  for (let s = 0; s < strokeCount; s++) {
    const startX = 80 + rand() * 540;
    const startY = 80 + rand() * 800;
    const len = 8 + Math.floor(rand() * 14);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (let p = 1; p < len; p++) {
      ctx.lineTo(
        startX + rand() * 200 - 50 + p * (rand() * 30 - 5),
        startY + rand() * 100 - 20 + p * (rand() * 20 + 5)
      );
    }
    ctx.stroke();
  }
}

// ─── 컴포넌트 ─────────────────────────────────────────────────

export function StudentReportDetail() {
  const { archiveId, userId } = useParams<{ archiveId: string; userId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get('role') === 'host';

  const participant = DUMMY_PARTICIPANTS.find(p => p.userId === userId) ?? DUMMY_PARTICIPANTS[1];
  const participantIdx = DUMMY_PARTICIPANTS.findIndex(p => p.userId === userId);

  // 재생 상태 (UI only)
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);

  // 캔버스 렌더링 (재생용)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPageStrokes(ctx, currentPage, participantIdx);
  }, [currentPage, participantIdx]);

  // 필기 재본 캔버스 렌더링 (호스트 버전B용 — 완성본 정적 표시)
  useEffect(() => {
    const canvas = canvasRef2.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPageStrokes(ctx, currentPage, participantIdx + 10);
  }, [currentPage, participantIdx]);

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
      {/* 수채화 배경 */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${watercolorBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-white/40 pointer-events-none" />

      {/* ─── 2-A. 상단 네비게이션 바 ─── */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/50 h-14 flex items-center px-6">
        <button
          onClick={() => navigate(`/archive/${archiveId}`)}
          className="text-gray-600 hover:text-gray-900 text-sm transition-colors flex-shrink-0"
        >
          ← 뒤로가기
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-800 text-base">
          {participant.nickname}의 필기 리플레이
        </h1>
        <span className="text-sm text-gray-500 flex-shrink-0 tabular-nums">
          {currentPage} / {TOTAL_PAGES}
        </span>
      </header>

      {/* ══ 버전 B: 호스트 진입 — 캔버스 2개만 ══ */}
      {isHost ? (
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 gap-6">

            {/* 좌: 필기 재생 */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">필기 재생</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(v => !v)}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {isPlaying ? '⏸ 일시정지' : '▶ 재생'}
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1 bg-white border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    처음으로
                  </button>
                  <div className="flex gap-1">
                    {([0.5, 1, 2] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          speed === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 flex flex-col items-center gap-3 flex-1">
                <div className="w-full bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={700}
                    height={990}
                    className="block w-full"
                    style={{ aspectRatio: '700 / 990' }}
                  />
                </div>
                {/* 타임라인 */}
                <div className="w-full flex flex-col gap-1">
                  <div
                    className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
                    onClick={handleSeek}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                      style={{ width: `${progress * 100}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-500 rounded-full"
                      style={{ left: `calc(${progress * 100}% - 6px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 tabular-nums">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(TOTAL_DURATION_MS)}</span>
                  </div>
                </div>
                {/* 페이지 네비 */}
                <div className="flex items-center gap-3">
                  <button onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-30">← 이전</button>
                  <span className="text-sm text-gray-600 font-medium tabular-nums">{currentPage} / {TOTAL_PAGES}</span>
                  <button onClick={() => goToPage(Math.min(TOTAL_PAGES, currentPage + 1))} disabled={currentPage === TOTAL_PAGES} className="px-3 py-1 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-30">다음 →</button>
                </div>
              </div>
            </div>

            {/* 우: 필기 재본 */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">필기 재본</span>
              </div>
              <div className="p-4 flex flex-col items-center gap-3 flex-1">
                <div className="w-full bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <canvas
                    ref={canvasRef2}
                    width={700}
                    height={990}
                    className="block w-full"
                    style={{ aspectRatio: '700 / 990' }}
                  />
                </div>
                {/* 페이지 표시 (재생과 동기) */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="tabular-nums font-medium">{currentPage}P</span>
                  <span className="text-gray-300">·</span>
                  <span>완성본</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      ) : (

      /* ══ 버전 A: 게스트(학생) 진입 — 기존 전체 레이아웃 ══ */
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* ─── 요약 카드 4개 ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: '활동 시간', value: '45분', color: 'text-blue-600' },
            { label: '참여 페이지', value: '3 / 5', color: 'text-purple-600' },
            { label: '피드백 수', value: '2회', color: 'text-green-600' },
            { label: '집중도', value: '85%', color: 'text-orange-600' },
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
          {DUMMY_FEEDBACKS.length === 0 ? (
            <p className="text-sm text-gray-400">피드백이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {DUMMY_FEEDBACKS.map((fb, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-blue-50/60 rounded-2xl border border-blue-100">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{fb.page}P</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{fb.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fb.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">스트로크 수</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">피드백</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {DUMMY_PAGE_STATS.map(row => (
                  <tr key={row.page} onClick={() => goToPage(row.page)} className={`cursor-pointer transition-colors ${row.page === currentPage ? 'bg-blue-50/60' : 'hover:bg-gray-50/60'}`}>
                    <td className="px-6 py-3 font-medium text-gray-800">
                      {row.page}P
                      {row.page === currentPage && <span className="ml-2 text-xs text-blue-500">● 현재</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{row.minutes}분</td>
                    <td className="px-6 py-3 text-gray-600">{row.strokes}개</td>
                    <td className="px-6 py-3">
                      {row.feedback > 0
                        ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{row.feedback}회</span>
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
