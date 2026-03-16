import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import watercolorBg from '../assets/images/watercolor-bg.png';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface PageStat {
  np: number;
  writingTime: string;
  hasFeedback: boolean;
}

interface ParticipantData {
  name: string;
  activityTime: number; // 분
  participatedPages: number;
  totalPages: number;
  feedbackCount: number;
  pages: PageStat[];
}

// ─── 더미 데이터 ──────────────────────────────────────────────────────────────

const DUMMY_PARTICIPANT: ParticipantData = {
  name: '김민준',
  activityTime: 15,
  participatedPages: 3,
  totalPages: 5,
  feedbackCount: 2,
  pages: [
    { np: 1, writingTime: '2분 30초', hasFeedback: false },
    { np: 2, writingTime: '3분 10초', hasFeedback: true },
    { np: 3, writingTime: '1분 50초', hasFeedback: false },
    { np: 4, writingTime: '4분 00초', hasFeedback: true },
    { np: 5, writingTime: '0분 00초', hasFeedback: false },
  ],
};

const PAGE_GROUP_SIZE = 4;

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function formatActivityTime(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatSeekTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SPEED_CYCLE: (0.5 | 1 | 2)[] = [1, 2, 0.5];

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function ReplayGuestPage() {
  const { sessionId, participantId } = useParams<{ sessionId: string; participantId: string }>();
  const navigate = useNavigate();

  // 실제 API 연동 전 더미 데이터 사용
  const participant = DUMMY_PARTICIPANT;

  // 페이지 그룹 상태
  const [groupIndex, setGroupIndex] = useState(0);
  const totalGroups = Math.ceil(participant.pages.length / PAGE_GROUP_SIZE);
  const currentGroupPages = participant.pages.slice(
    groupIndex * PAGE_GROUP_SIZE,
    groupIndex * PAGE_GROUP_SIZE + PAGE_GROUP_SIZE,
  );

  // 선택된 페이지 (테이블 하이라이트 + 모달)
  const [selectedNp, setSelectedNp] = useState<number | null>(null);

  // 필기 재생 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNp, setModalNp] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const TOTAL_SECONDS = 75; // 더미 전체 길이

  // 피드백이 있는 페이지 목록
  const feedbackPages = participant.pages.filter(p => p.hasFeedback);

  // 카드 클릭 → 모달 오픈
  function openModal(np: number) {
    setModalNp(np);
    setSelectedNp(np);
    setSeekTime(0);
    setIsPlaying(false);
    setModalOpen(true);
  }

  // 피드백 태그 클릭 → 해당 페이지가 속한 그룹으로 이동 + 포커스
  function jumpToFeedbackPage(np: number) {
    const targetGroup = Math.floor((np - 1) / PAGE_GROUP_SIZE);
    setGroupIndex(targetGroup);
    setSelectedNp(np);
  }

  // 배속 순환
  function cycleSpeed() {
    const idx = SPEED_CYCLE.indexOf(speed);
    setSpeed(SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length]);
  }

  // seek bar 클릭
  function handleSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSeekTime(Math.round(ratio * TOTAL_SECONDS));
  }

  const seekProgress = TOTAL_SECONDS > 0 ? seekTime / TOTAL_SECONDS : 0;

  return (
    <div className="min-h-screen relative">
      {/* 수채화 배경 */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${watercolorBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-white/40 pointer-events-none" />

      {/* ─── 헤더 ─── */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/50 h-14 flex items-center px-6 gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 hover:text-gray-900 text-sm transition-colors flex-shrink-0"
        >
          ← 뒤로가기
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-800 text-base truncate">
          {participant.name}의 필기 상세
        </h1>
        <span className="text-sm text-gray-400 flex-shrink-0 tabular-nums">
          {sessionId ?? ''} / {participantId ?? ''}
        </span>
      </header>

      {/* ─── 본문 ─── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ══ 요약 카드 3개 ══ */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow p-5 flex flex-col gap-1">
            <span className="text-xs text-gray-500">활동 시간</span>
            <span className="text-2xl font-bold text-blue-600">{formatActivityTime(participant.activityTime)}</span>
          </div>
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow p-5 flex flex-col gap-1">
            <span className="text-xs text-gray-500">참여 페이지</span>
            <span className="text-2xl font-bold text-purple-600">
              {participant.participatedPages} / {participant.totalPages}
            </span>
          </div>
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow p-5 flex flex-col gap-1">
            <span className="text-xs text-gray-500">받은 첨삭 수</span>
            <span className="text-2xl font-bold text-emerald-600">{participant.feedbackCount}회</span>
          </div>
        </div>

        {/* ══ 필기 페이지 그리드 ══ */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-600">필기 페이지</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupIndex(g => Math.max(0, g - 1))}
                disabled={groupIndex === 0}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all"
              >
                ← 이전 그룹
              </button>
              <span className="text-xs text-gray-400 tabular-nums">
                {groupIndex + 1} / {totalGroups}
              </span>
              <button
                onClick={() => setGroupIndex(g => Math.min(totalGroups - 1, g + 1))}
                disabled={groupIndex >= totalGroups - 1}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all"
              >
                다음 그룹 →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {currentGroupPages.map(pg => (
              <button
                key={pg.np}
                onClick={() => openModal(pg.np)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all hover:shadow-md text-left ${
                  selectedNp === pg.np
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                {/* 빈 캔버스 (A4 비율) */}
                <div className="bg-white w-full" style={{ aspectRatio: '210/297' }} />
                {/* 첨삭 뱃지 */}
                {pg.hasFeedback && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">✓</span>
                  </span>
                )}
                {/* 페이지 번호 바 */}
                <div className={`px-2 py-1.5 flex items-center justify-center gap-1.5 ${
                  selectedNp === pg.np ? 'bg-blue-50' : 'bg-gray-50'
                }`}>
                  <span className={`text-xs font-semibold ${
                    selectedNp === pg.np ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {pg.np}P
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ══ 피드백 다시보기 (첨삭 있을 때만) ══ */}
        {feedbackPages.length > 0 && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-5 flex flex-col gap-3">
            <h2 className="font-bold text-gray-800 text-base">피드백 다시보기</h2>
            <p className="text-sm text-gray-500">{feedbackPages.length}페이지에 첨삭이 있어요</p>
            <div className="flex items-center gap-2 flex-wrap">
              {feedbackPages.map(fp => (
                <button
                  key={fp.np}
                  onClick={() => jumpToFeedbackPage(fp.np)}
                  className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-100 transition-colors"
                >
                  {fp.np}P
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══ 페이지 참여 요약 테이블 ══ */}
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
                {participant.pages.map(row => (
                  <tr
                    key={row.np}
                    onClick={() => openModal(row.np)}
                    className={`cursor-pointer transition-colors ${
                      selectedNp === row.np ? 'bg-blue-50/60' : 'hover:bg-gray-50/60'
                    }`}
                  >
                    <td className="px-6 py-3 font-medium text-gray-800">
                      {row.np}P
                      {selectedNp === row.np && (
                        <span className="ml-2 text-xs text-blue-500">● 선택</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{row.writingTime}</td>
                    <td className="px-6 py-3">
                      {row.hasFeedback
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

      {/* ══ 필기 재생 모달 ══ */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl w-full max-w-md flex flex-col gap-0 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">필기 재생</h3>
              <span className="text-sm text-gray-400">{modalNp}P</span>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none transition-colors ml-4"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 캔버스 영역 (blank) */}
            <div className="px-6 pt-5">
              <div
                className="w-full bg-white rounded-xl border border-gray-100 shadow-inner"
                style={{ aspectRatio: '210/297' }}
              />
            </div>

            {/* 재생 컨트롤러 */}
            <div className="px-6 pt-4 pb-6 flex flex-col gap-4">
              {/* seek bar */}
              <div className="flex flex-col gap-1.5">
                <div
                  className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
                  onClick={handleSeekClick}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                    style={{ width: `${seekProgress * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full shadow transition-all"
                    style={{ left: `calc(${seekProgress * 100}% - 7px)` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 tabular-nums">
                  <span>{formatSeekTime(seekTime)}</span>
                  <span>{formatSeekTime(TOTAL_SECONDS)}</span>
                </div>
              </div>

              {/* 버튼 행 */}
              <div className="flex items-center justify-center gap-3">
                {/* -10초 */}
                <button
                  onClick={() => setSeekTime(t => Math.max(0, t - 10))}
                  className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors flex items-center justify-center"
                >
                  −10
                </button>

                {/* 재생 / 일시정지 */}
                <button
                  onClick={() => setIsPlaying(v => !v)}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center justify-center"
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>

                {/* +10초 */}
                <button
                  onClick={() => setSeekTime(t => Math.min(TOTAL_SECONDS, t + 10))}
                  className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors flex items-center justify-center"
                >
                  +10
                </button>

                {/* 배속 순환 */}
                <button
                  onClick={cycleSpeed}
                  className="ml-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors min-w-[40px]"
                >
                  {speed}x
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
