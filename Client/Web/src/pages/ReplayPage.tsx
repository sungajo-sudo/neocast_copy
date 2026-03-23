import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

interface ArchiveItem {
  archiveId: string;
  sessionName: string;
  participantCount: number;
  endedAt: string;
  pages: number;
}

const DUMMY_PARTICIPANTS = [
  { userId: 'host_001', nickname: '김선생', role: 'host' },
  { userId: 'guest_001', nickname: '박민준', role: 'guest' },
  { userId: 'guest_002', nickname: '이서연', role: 'guest' },
  { userId: 'guest_003', nickname: '최도윤', role: 'guest' },
  { userId: 'guest_004', nickname: '정하은', role: 'guest' },
  { userId: 'guest_005', nickname: '강지우', role: 'guest' },
];

const STROKE_COLORS = ['#4F86F7', '#FF6B6B', '#51CF66', '#FF9F43', '#A29BFE'];

/** 페이지·참가자 인덱스 기반 결정론적 더미 타임라인 생성 */
function generateTimeline(seed: number): StrokePoint[][] {
  // 간단한 seeded random (LCG)
  let s = seed * 1234567 + 1;
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };

  return Array.from({ length: 6 }, (_, si) =>
    Array.from({ length: 30 }, (_, pi) => ({
      x: 60 + rand() * 580,
      y: 60 + rand() * 870,
      pressure: 0.5 + rand() * 0.4,
      timestamp: si * 2500 + pi * 90 + rand() * 40,
    }))
  );
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function ReplayPage() {
  const { archiveId } = useParams<{ archiveId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const userId = searchParams.get('userId') ?? 'host_001';
  const currentPage = Number(searchParams.get('page') ?? 1);

  const [archive, setArchive] = useState<ArchiveItem | null>(null);
  const participant = DUMMY_PARTICIPANTS.find(p => p.userId === userId) ?? DUMMY_PARTICIPANTS[0];
  const participantIdx = DUMMY_PARTICIPANTS.findIndex(p => p.userId === userId);

  // 리플레이 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(1);

  // 타임라인 생성 (페이지 + 참가자 인덱스 기반)
  const timeline = useRef<StrokePoint[][]>([]);
  const totalDuration = useRef(0);

  useEffect(() => {
    const seed = currentPage * 100 + participantIdx;
    timeline.current = generateTimeline(seed);
    const flat = timeline.current.flat();
    totalDuration.current = flat.length > 0 ? Math.max(...flat.map(p => p.timestamp)) + 500 : 1;
    // 페이지 변경 시 처음으로
    currentTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, [currentPage, participantIdx]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nc_archives') || '[]') as ArchiveItem[];
      const found = saved.find(a => a.archiveId === archiveId);
      setArchive(found ?? null);
    } catch {}
  }, [archiveId]);

  // 캔버스 렌더링
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const t = currentTimeRef.current;

    timeline.current.forEach((stroke, si) => {
      const visiblePoints = stroke.filter(p => p.timestamp <= t);
      if (visiblePoints.length < 2) return;

      const color = STROKE_COLORS[(participantIdx + si) % STROKE_COLORS.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
      for (let i = 1; i < visiblePoints.length; i++) {
        ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
      }
      ctx.stroke();
    });
  }, [participantIdx]);

  // 애니메이션 루프
  const animate = useCallback((timestamp: number) => {
    if (!isPlayingRef.current) return;

    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const delta = (timestamp - lastTimeRef.current) * speedRef.current;
    lastTimeRef.current = timestamp;

    currentTimeRef.current = Math.min(currentTimeRef.current + delta, totalDuration.current);
    setCurrentTime(currentTimeRef.current);
    render();

    if (currentTimeRef.current >= totalDuration.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      lastTimeRef.current = 0;
      return;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [render]);

  // isPlaying 변화 감지
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, animate]);

  // speed 변화 감지
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // 초기 렌더링 + currentTime 변화 시 렌더
  useEffect(() => {
    render();
  }, [currentTime, render]);

  const handleReset = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    currentTimeRef.current = 0;
    setCurrentTime(0);
    lastTimeRef.current = 0;
    render();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * totalDuration.current;
    currentTimeRef.current = newTime;
    setCurrentTime(newTime);
    render();
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
  };

  const totalPages = archive?.pages ?? 1;
  const progress = totalDuration.current > 0 ? currentTime / totalDuration.current : 0;

  return (
    <div className="min-h-screen relative">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#fff1e6] h-14 flex items-center px-6 gap-4">
        <button
          onClick={() => navigate(`/archive/${archiveId}`)}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-sm transition-colors flex-shrink-0"
        >
          ← 뒤로
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <h1 className="font-bold text-gray-800 text-base truncate">
            {participant.nickname}의 필기 리플레이
          </h1>
        </div>
        {/* 페이지 이동 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-7 h-7 rounded-full bg-white border border-[#fff1e6] shadow-[var(--shadow-card)] text-gray-600 hover:bg-white disabled:opacity-30 transition-all text-sm"
          >
            ←
          </button>
          <span className="text-xs text-gray-500 min-w-[60px] text-center">
            {currentPage} / {totalPages} 페이지
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="w-7 h-7 rounded-full bg-white border border-[#fff1e6] shadow-[var(--shadow-card)] text-gray-600 hover:bg-white disabled:opacity-30 transition-all text-sm"
          >
            →
          </button>
        </div>
      </header>

      {/* 본문 */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-4 py-6">
        {/* A4 캔버스 */}
        <div className="neo-card overflow-hidden">
          <canvas
            ref={canvasRef}
            width={700}
            height={990}
            className="block w-full max-w-sm sm:max-w-md"
            style={{ aspectRatio: '700 / 990' }}
          />
        </div>

        {/* 컨트롤 패널 */}
        <div className="w-full max-w-sm sm:max-w-md neo-card p-5 flex flex-col gap-4">
          {/* 재생 버튼 그룹 */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setIsPlaying(v => !v)}
              className="neo-btn-primary text-sm min-w-[80px]"
            >
              {isPlaying ? '⏸ 일시정지' : '▶ 재생'}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 active:scale-95 transition-all"
            >
              ↺ 처음으로
            </button>
          </div>

          {/* 배속 선택 */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-gray-500 mr-1">속도:</span>
            {[0.5, 1, 2].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  speed === s
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* 진행 바 */}
          <div className="flex flex-col gap-1.5">
            <div
              className="relative h-2 bg-gray-200 rounded-full cursor-pointer group"
              onClick={handleSeek}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                style={{ width: `${progress * 100}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full shadow transition-all"
                style={{ left: `calc(${progress * 100}% - 7px)` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(totalDuration.current)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
