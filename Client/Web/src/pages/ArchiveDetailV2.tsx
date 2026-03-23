import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandwritingThumbnail } from '../components/HandwritingThumbnail';
import { VOICE_EVENTS } from '../data/voiceScenario';
import type { VoiceEvent } from '../data/voiceScenario';
import { getParticipationLevel } from '../types/archive';
import type { ParticipationLevel } from '../types/archive';
import { getAnalysisCache, setAnalysisCache, clearAnalysisCache } from '../utils/analysisCache';

interface ArchiveItem {
  archiveId: string;
  sessionName: string;
  participantCount: number;
  endedAt: string;
  pages: number;
}

interface Student {
  userId: string;
  nickname: string;
}

interface PageData {
  pageNum: number;
  title: string;
  students: {
    userId: string;
    nickname: string;
    strokeCount: number;
    maxStroke: number;
  }[];
}

interface WorksheetInfo {
  filename: string;
  pages: number;
  uploadedAt: string;
  sobp: string;
}

interface SessionAnalysis {
  summary: string;
  keyConcepts: string[];
  questionHotspot: string;
  nextClassRecommendation: string;
}

interface StudentAnalysis {
  currentStatus: string;
  strengths: string;
  improvements: string;
  studyRecommendation: string;
}

const WORKSHEET: WorksheetInfo = {
  filename: '중3_이차방정식_단원평가.pdf',
  pages: 3,
  uploadedAt: '2026-03-21',
  sobp: '3.27.168.1',
};

const STUDENTS: Student[] = [
  { userId: 'guest_001', nickname: '박민준' },
  { userId: 'guest_002', nickname: '이서연' },
  { userId: 'guest_003', nickname: '최도윤' },
  { userId: 'guest_004', nickname: '정하은' },
  { userId: 'guest_005', nickname: '강지우' },
];

const PAGES_DATA: PageData[] = [
  {
    pageNum: 1,
    title: '근의 공식 유도 및 예제',
    students: [
      { userId: 'guest_001', nickname: '박민준', strokeCount: 127, maxStroke: 148 },
      { userId: 'guest_002', nickname: '이서연', strokeCount: 148, maxStroke: 148 },
      { userId: 'guest_003', nickname: '최도윤', strokeCount: 63, maxStroke: 148 },
      { userId: 'guest_004', nickname: '정하은', strokeCount: 112, maxStroke: 148 },
      { userId: 'guest_005', nickname: '강지우', strokeCount: 0, maxStroke: 148 },
    ],
  },
  {
    pageNum: 2,
    title: '판별식 활용 문제',
    students: [
      { userId: 'guest_001', nickname: '박민준', strokeCount: 89, maxStroke: 134 },
      { userId: 'guest_002', nickname: '이서연', strokeCount: 134, maxStroke: 134 },
      { userId: 'guest_003', nickname: '최도윤', strokeCount: 41, maxStroke: 134 },
      { userId: 'guest_004', nickname: '정하은', strokeCount: 121, maxStroke: 134 },
      { userId: 'guest_005', nickname: '강지우', strokeCount: 72, maxStroke: 134 },
    ],
  },
  {
    pageNum: 3,
    title: '종합 서술형 풀이',
    students: [
      { userId: 'guest_001', nickname: '박민준', strokeCount: 95, maxStroke: 110 },
      { userId: 'guest_002', nickname: '이서연', strokeCount: 52, maxStroke: 110 },
      { userId: 'guest_003', nickname: '최도윤', strokeCount: 18, maxStroke: 110 },
      { userId: 'guest_004', nickname: '정하은', strokeCount: 110, maxStroke: 110 },
      { userId: 'guest_005', nickname: '강지우', strokeCount: 0, maxStroke: 110 },
    ],
  },
];

const DUMMY_SESSION_ANALYSIS: SessionAnalysis = {
  summary: '인수분해, 완전제곱식, 근의 공식 세 가지 풀이법을 순서대로 다룬 수업입니다. 판별식 개념(2페이지)과 허근(5페이지) 구간에서 학생 질문이 집중되었으며, 7페이지에서는 풀이법 간 관계에 대한 심화 질문이 있었습니다. 필기 데이터 기준 전체 평균 참여율은 68%이며, 후반부로 갈수록 필기 밀도가 높아졌습니다.',
  keyConcepts: ['판별식', '중근', '인수분해', '근의 공식', '완전제곱식', '허근'],
  questionHotspot: '2페이지(14:15)와 5페이지(14:38~14:42)에 질문이 집중되었습니다. 판별식 값에 따른 근의 분류가 한 번에 이해되지 않아 반복 확인이 필요했던 것으로 보입니다.',
  nextClassRecommendation: '판별식의 부호에 따라 포물선과 x축의 위치 관계가 어떻게 달라지는지 그래프로 비교하는 활동을 권장합니다. 부호 실수가 있는 학생에게는 근의 공식 대입 시 괄호 표기를 강조하는 연습 문제를 사전 배포하세요.',
};

const DUMMY_STUDENT_ANALYSES: Record<string, StudentAnalysis> = {
  guest_001: {
    currentStatus: '3개 페이지 전체에 고른 필기 활동을 보였으며, 평균 참여율 79%로 양호합니다. 풀이 방향은 정확하나 중간 계산 과정에서 부호 처리 실수가 간헐적으로 발생합니다.',
    strengths: '풀이 과정을 생략하지 않고 단계별로 작성하는 습관이 잘 형성되어 있습니다. 필기 밀도가 전 페이지에 걸쳐 안정적입니다.',
    improvements: '근의 공식 대입 시 -b를 (-b)로 괄호 처리하지 않아 부호가 바뀌는 실수가 보입니다. 답을 구한 후 검산 과정이 없습니다.',
    studyRecommendation: 'b가 음수인 이차방정식 연습 문제 5개를 풀면서 매 문제마다 괄호 표기와 검산을 반드시 포함하세요. 구한 근을 원래 식에 대입해 0이 되는지 확인하는 한 줄이면 충분합니다.',
  },
  guest_002: {
    currentStatus: '1~2페이지에서 매우 높은 필기 밀도(148획, 134획)를 보였으나 3페이지에서 52획으로 급감했습니다. 서술형 풀이 파트에서 집중력이 떨어졌을 가능성이 있습니다.',
    strengths: '인수분해와 판별식 파트에서 전체 학생 중 가장 높은 필기 밀도를 기록했습니다. 기본 개념 이해가 탄탄합니다.',
    improvements: '서술형 풀이(3페이지)에서 필기량이 크게 감소했습니다. 풀이 과정을 글로 서술하는 연습이 필요합니다.',
    studyRecommendation: '서술형 문제 3개를 골라 풀이 과정을 문장으로 쓰는 연습을 하세요. "① 식 정리 → ② 대입 → ③ 계산 → ④ 답" 번호를 매기며 쓰면 구조화에 도움이 됩니다.',
  },
  guest_003: {
    currentStatus: '전체 참여율 31%로 가장 낮은 수준입니다. 페이지별로 63획, 41획, 18획으로 점차 감소하는 추세를 보이며, 수업 후반부로 갈수록 참여가 현저히 떨어졌습니다.',
    strengths: '1페이지에서 63획으로 기본적인 풀이 시도는 하고 있어, 인수분해 기초 개념은 이해하고 있는 것으로 보입니다.',
    improvements: '판별식과 근의 공식 파트(2~3페이지)에서 필기량이 급감하여 해당 개념의 이해도 확인이 필요합니다. 추가 학습 지원을 고려해주세요.',
    studyRecommendation: '인수분해 기본 문제부터 다시 시작하여 자신감을 회복한 후, 근의 공식으로 단계적으로 넘어가세요. 한 번에 1~2문제씩 짧게 반복하는 것이 효과적입니다.',
  },
  guest_004: {
    currentStatus: '3개 페이지 모두 안정적인 필기량을 유지하며(112획, 121획, 110획) 전체 참여율 87%로 최상위입니다. 별도 첨삭 없이 풀이를 완성했습니다.',
    strengths: '모든 페이지에서 고른 필기 밀도를 유지하며, 첨삭 없이 정확한 풀이를 완성한 점에서 기본기가 매우 탄탄합니다.',
    improvements: '필기 데이터만으로는 심화 개념(허근, 완전제곱식 유도 등)에 대한 이해 수준을 파악하기 어렵습니다. 심화 문제로 도전 범위를 넓혀볼 필요가 있습니다.',
    studyRecommendation: '기본 풀이력이 충분하므로 심화 문제(판별식 조건 문제, 정수근 조건 등)에 도전해보세요. 풀이 후 다른 방법으로도 풀어보는 연습이 수학적 사고력 향상에 도움됩니다.',
  },
  guest_005: {
    currentStatus: '1페이지와 3페이지에서 필기 활동이 없으며(0획), 2페이지에서만 72획이 기록되었습니다. 전체 참여율 18%로 수업 참여에 어려움이 있었던 것으로 보입니다.',
    strengths: '2페이지에서 72획의 필기 활동이 있어, 판별식 파트에서는 풀이를 시도한 흔적이 있습니다.',
    improvements: '1, 3페이지 미필기 상태로, 인수분해와 서술형 풀이 파트의 이해도를 별도로 확인할 필요가 있습니다. 수업 참여를 방해하는 요인이 있는지 파악이 필요합니다.',
    studyRecommendation: '가장 기본적인 인수분해 문제(예: x²-5x+6=0)부터 1문제씩 풀어보며 성공 경험을 쌓으세요. 어려운 부분이 있으면 선생님에게 질문하는 것을 두려워하지 마세요.',
  },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function getRate(strokeCount: number, maxStroke: number): number {
  if (maxStroke === 0) return 0;
  return Math.round((strokeCount / maxStroke) * 100);
}

// Modern Soft: getParticipationLevel 기반 스타일링
function getRateBarWidth(rate: number): string {
  return `${rate}%`;
}

function getLevelBarColor(level: ParticipationLevel): string {
  switch (level) {
    case 'none': return 'bg-gray-200';
    case 'low': return 'bg-brand-primary/30';
    case 'mid': return 'bg-brand-primary/60';
    case 'high': return 'bg-brand-primary';
  }
}

function getRateBarColor(rate: number, hasWriting: boolean): string {
  return getLevelBarColor(getParticipationLevel(rate, hasWriting));
}

type ViewTab = 'page' | 'student' | 'ai';
type VoiceFilter = 'all' | 'questions' | 'feedback';

function getEventTypeLabel(e: VoiceEvent): { label: string; color: string } {
  if (e.type === 'explanation') return { label: '설명', color: 'bg-gray-100 text-gray-600' };
  if (e.type === 'question') return { label: '질문', color: 'bg-brand-tint text-brand-primary' };
  if (e.type === 'answer') return { label: '답변', color: 'bg-gray-100 text-gray-700' };
  if (e.type === 'feedback') return { label: '첨삭', color: 'bg-brand-tint text-brand-primary' };
  return { label: '', color: '' };
}

export function ArchiveDetailV2({ archive }: { archive: ArchiveItem }) {
  const navigate = useNavigate();
  const [viewTab, setViewTab] = useState<ViewTab>('page');

  const [sessionAnalysis, setSessionAnalysis] = useState<SessionAnalysis | null>(null);
  const [sessionAnalyzing, setSessionAnalyzing] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [studentAnalyses, setStudentAnalyses] = useState<Record<string, StudentAnalysis>>({});
  const [studentAnalyzing, setStudentAnalyzing] = useState<Set<string>>(new Set());

  // 필기 리플레이 모달
  const [writingModal, setWritingModal] = useState<{ open: boolean; studentIdx: number; pageIdx: number }>({ open: false, studentIdx: 0, pageIdx: 0 });
  const [replayState, setReplayState] = useState<{ playing: boolean; progress: number }>({ playing: false, progress: 0 });
  const replayTimerRef = useRef<number | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  // Q&A 타임라인 필터
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilter>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const timelineRef = useRef<HTMLDivElement>(null);

  const filteredEvents = useMemo(() => {
    return VOICE_EVENTS.filter(event => {
      const voiceMatch =
        voiceFilter === 'all' ||
        (voiceFilter === 'questions' && event.type === 'question') ||
        (voiceFilter === 'feedback' && event.type === 'feedback');
      const studentMatch =
        studentFilter === 'all' ||
        event.studentId === studentFilter ||
        event.speaker === 'host';
      return voiceMatch && studentMatch;
    });
  }, [voiceFilter, studentFilter]);

  // 캐시에서 이전 분석 결과 복원
  useEffect(() => {
    const cache = getAnalysisCache(archive.archiveId);
    if (cache?.sessionResult) {
      try {
        setSessionAnalysis(JSON.parse(cache.sessionResult));
      } catch { /* 파싱 실패 시 무시 */ }
    }
    if (cache?.studentResults) {
      const restored: Record<string, StudentAnalysis> = {};
      for (const [userId, json] of Object.entries(cache.studentResults)) {
        try { restored[userId] = JSON.parse(json); } catch { /* skip */ }
      }
      if (Object.keys(restored).length > 0) {
        setStudentAnalyses(restored);
      }
    }
  }, [archive.archiveId]);



  const toggleStudentExpand = (userId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const startSessionAnalysis = () => {
    if (sessionAnalyzing) return; // 중복 클릭 방어
    setSessionAnalyzing(true);
    setTimeout(() => {
      setSessionAnalysis(DUMMY_SESSION_ANALYSIS);
      setSessionAnalyzing(false);
      setAnalysisCache(archive.archiveId, {
        sessionResult: JSON.stringify(DUMMY_SESSION_ANALYSIS),
      });
    }, 2000);
  };

  const resetSessionAnalysis = () => {
    clearAnalysisCache(archive.archiveId);
    setSessionAnalysis(null);
    setStudentAnalyses({});
  };

  const startStudentAnalysis = (userId: string) => {
    if (studentAnalyzing.has(userId)) return; // 중복 클릭 방어
    setStudentAnalyzing(prev => new Set(prev).add(userId));
    setTimeout(() => {
      const result = DUMMY_STUDENT_ANALYSES[userId];
      setStudentAnalyses(prev => {
        const updated = { ...prev, [userId]: result };
        // 학생 분석 결과도 캐시에 저장
        const cache = getAnalysisCache(archive.archiveId);
        const studentResults = cache?.studentResults ?? {};
        studentResults[userId] = JSON.stringify(result);
        setAnalysisCache(archive.archiveId, { studentResults });
        return updated;
      });
      setStudentAnalyzing(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }, 1500);
  };

  // ── 필기 모달 ──
  const openWritingModal = (studentIdx: number, pageIdx: number) => {
    stopReplay();
    setWritingModal({ open: true, studentIdx, pageIdx });
  };

  const closeWritingModal = () => {
    stopReplay();
    setWritingModal(prev => ({ ...prev, open: false }));
  };

  const modalNavPage = (dir: number) => {
    stopReplay();
    setWritingModal(prev => {
      const newPi = prev.pageIdx + dir;
      if (newPi < 0 || newPi >= PAGES_DATA.length) return prev;
      return { ...prev, pageIdx: newPi };
    });
  };

  const stopReplay = () => {
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setReplayState({ playing: false, progress: 0 });
  };

  const startReplay = () => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { studentIdx, pageIdx } = writingModal;
    const student = PAGES_DATA[pageIdx]?.students[studentIdx];
    if (!student || student.strokeCount === 0) return;

    // Get handwriting data
    const hwIdx = studentIdx % 5;
    const pgIdx = pageIdx % 3;
    const hw = (window as any).__HANDWRITING_SETS?.[hwIdx]?.[pgIdx];
    if (!hw || !hw.lines || hw.lines.length === 0) return;

    // Flatten all chars
    const allChars: string[] = [];
    hw.lines.forEach((line: string) => {
      for (const ch of line) allChars.push(ch);
      allChars.push('\n');
    });

    setReplayState({ playing: true, progress: 0 });
    let idx = 0;

    const tick = () => {
      if (idx >= allChars.length) {
        setReplayState({ playing: false, progress: 100 });
        return;
      }

      // Draw up to current char (simple reveal)
      const progress = Math.round((idx / allChars.length) * 100);
      setReplayState(prev => prev.playing ? { playing: true, progress } : prev);

      // Redraw canvas with partial text
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, canvas.width, 110);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(canvas.width, 110); ctx.stroke();

      // Lines
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      for (let y = 80; y < canvas.height; y += 36) {
        ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(canvas.width - 20, y); ctx.stroke();
      }

      // Partial handwriting
      ctx.fillStyle = '#1a1a2e';
      ctx.font = '20px "Noto Sans KR", sans-serif';
      let lineNum = 0;
      let charInLine = 0;
      let drawn = 0;
      for (let c = 0; c <= idx && c < allChars.length; c++) {
        if (allChars[c] === '\n') {
          lineNum++;
          charInLine = 0;
        } else {
          const xJitter = ((studentIdx * 7 + lineNum * 3) % 5) - 2;
          ctx.fillText(allChars[c], 30 + xJitter + charInLine * 12, 290 + lineNum * 42);
          charInLine++;
          drawn++;
        }
      }

      idx += 2; // 2 chars at a time for speed
      replayTimerRef.current = window.setTimeout(tick, 50);
    };

    tick();
  };

  const toggleReplay = () => {
    if (replayState.playing) {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      setReplayState(prev => ({ ...prev, playing: false }));
    } else {
      if (replayState.progress >= 100) {
        // Restart
        stopReplay();
        setTimeout(startReplay, 50);
      } else {
        startReplay();
      }
    }
  };

  // keyboard for modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!writingModal.open) return;
      if (e.key === 'Escape') closeWritingModal();
      if (e.key === 'ArrowLeft') modalNavPage(-1);
      if (e.key === 'ArrowRight') modalNavPage(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [writingModal.open]);

  // Expose handwriting data for replay
  useEffect(() => {
    // Make HANDWRITING_SETS available for replay
    (window as any).__HANDWRITING_SETS = [
      [
        { lines: ['x² - 5x + 6 = 0', '(x - 2)(x - 3) = 0', '∴ x = 2 또는 x = 3'] },
        { lines: ['x = (-3 ± √(9+16)) / 4', 'x = (-3 ± 5) / 4', 'x = 1/2 또는 x = -2'] },
        { lines: ['근과 계수의 관계:', '합: -(-7)/1 = 7', '곱: 12/1 = 12'] },
      ],
      [
        { lines: ['x² - 5x + 6 = 0', '두 근의 합=5, 곱=6', '(x-2)(x-3) = 0', 'x = 2 또는 x = 3', '검산: 4-10+6=0 ✓'] },
        { lines: ['2x² + 3x - 2 = 0', 'a=2, b=3, c=-2', 'D = 9+16 = 25', 'x = (-3±5)/4', 'x=1/2, x=-2'] },
        { lines: ['합: 7, 곱: 12', '(x-3)(x-4) = 0', '검산: 3+4=7, 3×4=12 ✓'] },
      ],
      [
        { lines: ['x² - 5x + 6 = 0', '합:5 곱:6 탐색...', '(x-2)(x-3)=0'] },
        { lines: ['근의 공식 적용', 'x = (-3 ± √25) / 4', '...계산 중'] },
        { lines: ['합 = 7', '곱 = 12'] },
      ],
      [
        { lines: ['[풀이]', 'x² - 5x + 6 = 0', '→ (x-2)(x-3) = 0', '→ x = 2, x = 3', '[답] x = 2 또는 3'] },
        { lines: ['[풀이]', '2x²+3x-2 = 0', 'D = b²-4ac = 25', 'x = (-3±5)/4', '[답] x=1/2, -2'] },
        { lines: ['[풀이]', '비에타 공식 적용', '합: -b/a = 7', '곱: c/a = 12', '[답] 합=7, 곱=12'] },
      ],
      [
        { lines: ['x² - 5x + 6 = 0', '...'] },
        { lines: ['2x² + 3x - 2 = 0', '근의 공식...', 'x = (-3 ± ?) / 4'] },
        { lines: [] },
      ],
    ];
    return () => { delete (window as any).__HANDWRITING_SETS; };
  }, []);

  const getStudentTotalRate = (userId: string) => {
    let totalStroke = 0;
    let totalMax = 0;
    PAGES_DATA.forEach(page => {
      const s = page.students.find(st => st.userId === userId);
      if (s) {
        totalStroke += s.strokeCount;
        totalMax += s.maxStroke;
      }
    });
    return totalMax === 0 ? 0 : Math.round((totalStroke / totalMax) * 100);
  };

  const getStudentVoiceEvents = (nickname: string) => {
    return VOICE_EVENTS.filter(e => e.studentName === nickname || (e.type === 'feedback' && e.transcript.includes(nickname)));
  };

  const avgRate = Math.round(STUDENTS.reduce((sum, s) => sum + getStudentTotalRate(s.userId), 0) / STUDENTS.length);

  return (
    <div className="min-h-screen bg-app-bg">
      <main className="max-w-5xl mx-auto px-6 pt-12 pb-32">

        {/* ── 헤더 ── */}
        <section className="mb-12">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center text-gray-400 hover:text-brand-primary mb-6 group transition-colors"
          >
            <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">목록으로 돌아가기</span>
          </button>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">
            {archive.sessionName}
          </h1>
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <span className="font-medium">{formatDate(archive.endedAt)}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>{STUDENTS.length}명 참여</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>42분</span>
          </div>
        </section>

        {/* ── 워크시트 정보 ── */}
        <section className="mb-10 flex items-center gap-3 text-sm text-gray-500">
          <div className="neo-icon-wrap w-8 h-8 flex-shrink-0">
            <svg className="w-4 h-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-medium text-gray-700">{WORKSHEET.filename}</span>
          <span className="text-gray-300">·</span>
          <span>{WORKSHEET.pages}페이지</span>
          <span className="text-gray-300">·</span>
          <span>SOBP {WORKSHEET.sobp}</span>
        </section>

        {/* ── 요약 메트릭 ── */}
        <section className="mb-16 border-y border-app-border py-8">
          <div className="flex flex-wrap gap-12 text-gray-600 tracking-tight">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">수업시간</span>
              <span className="text-lg font-semibold">42분</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">참여학생</span>
              <span className="text-lg font-semibold">{STUDENTS.length}명</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">평균완료율</span>
              <span className="text-lg font-semibold">{avgRate}%</span>
            </div>
          </div>
        </section>

        {/* ── 탭 ── */}
        <section className="mb-8">
          <div className="flex gap-1.5 p-1 bg-brand-tint/30 rounded-2xl w-fit">
            {[
              { key: 'page' as const, label: '페이지별 보기' },
              { key: 'student' as const, label: '학생별 보기' },
              { key: 'ai' as const, label: 'AI 분석' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewTab(tab.key)}
                className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                  viewTab === tab.key
                    ? 'bg-white shadow-sm text-brand-primary'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── 페이지별 보기 ── */}
        {viewTab === 'page' && (
          <section className="flex flex-col gap-6 mb-16">
            {/* 참여율 히트맵 테이블 */}
            <div className="neo-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-tint/20">
                      <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest w-24">학생</th>
                      {PAGES_DATA.map(p => (
                        <th key={p.pageNum} className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                          P{p.pageNum}
                        </th>
                      ))}
                      <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5">
                          전체 참여율
                          <span className="relative group cursor-help">
                            <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold inline-flex items-center justify-center">?</span>
                            <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-gray-800 text-white text-[11px] font-normal normal-case tracking-normal leading-snug rounded-lg shadow-lg z-20">
                              각 페이지의 필기 밀도(스트로크 수 / 최대 스트로크 수)를 평균한 값입니다.
                              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                            </span>
                          </span>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {STUDENTS.map(student => {
                      const totalRate = getStudentTotalRate(student.userId);
                      return (
                        <tr key={student.userId} className="hover:bg-brand-tint/10 transition-colors">
                          <td className="px-5 py-3 font-semibold text-gray-700 text-xs">{student.nickname}</td>
                          {PAGES_DATA.map(page => {
                            const s = page.students.find(st => st.userId === student.userId);
                            const rate = s ? getRate(s.strokeCount, s.maxStroke) : 0;
                            return (
                              <td key={page.pageNum} className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-1 w-24 bg-brand-tint/40 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${getRateBarColor(rate, rate > 0)}`}
                                      style={{ width: getRateBarWidth(rate) }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-medium text-gray-400">{rate > 0 ? `${rate}%` : '미필기'}</span>
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1 w-24 bg-brand-tint/40 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getRateBarColor(totalRate, totalRate > 0)}`}
                                  style={{ width: getRateBarWidth(totalRate) }}
                                />
                              </div>
                              <span className="text-xs font-bold text-gray-600">{totalRate}%</span>
                              <span className="text-[9px] text-gray-400">참여율</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {PAGES_DATA.map(page => {
              const feedbackCount = VOICE_EVENTS.filter(e => e.type === 'feedback' && e.pageNumber === page.pageNum).length;

              return (
                <div key={page.pageNum}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded-md bg-gray-800 text-white text-xs font-bold flex items-center justify-center">P{page.pageNum}</span>
                    <span className="text-xs text-gray-500">
                      {page.students.filter(s => s.strokeCount > 0).length}명 필기
                      {feedbackCount > 0 && <> · <span className="text-brand-primary font-semibold">첨삭 {feedbackCount}건</span></>}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {page.students.map((student, idx) => {
                      const rate = getRate(student.strokeCount, student.maxStroke);
                      return (
                        <div
                          key={student.userId}
                          className="flex flex-col bg-white rounded-xl overflow-hidden hover:shadow-sm transition-shadow cursor-pointer"
                          onClick={() => openWritingModal(idx, page.pageNum - 1)}
                        >
                          <div className="px-2.5 pt-2 pb-1 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-gray-700">{student.nickname}</span>
                            <span className="text-[10px] font-medium text-gray-400">
                              {rate === 0 ? '미필기' : `${rate}%`}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 mx-auto" style={{ aspectRatio: '210 / 297' }}>
                            <HandwritingThumbnail seed={idx} studentName={student.nickname} pageNum={page.pageNum} />
                          </div>
                          <div className="px-2.5 py-1.5">
                            <div className="h-0.5 bg-brand-tint/40 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getRateBarColor(rate, rate > 0)}`}
                                style={{ width: getRateBarWidth(rate) }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ── 학생별 보기 ── */}
        {viewTab === 'student' && (
          <section className="mb-16 flex flex-col gap-5">
            {STUDENTS.map((student, idx) => {
              return (
                <div key={student.userId} className="neo-card overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-tint flex items-center justify-center text-brand-primary font-bold text-sm">
                        {student.nickname.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800">{student.nickname}</div>
                      </div>
                    </div>
                  </div>


                  {/* Page thumbnails */}
                  <div className="grid grid-cols-3 divide-x divide-app-border">
                    {PAGES_DATA.map((page, pi) => {
                      const feedbackOnPage = VOICE_EVENTS.filter(e => e.type === 'feedback' && e.pageNumber === page.pageNum && (e.studentName === student.nickname || e.transcript.includes(student.nickname)));
                      return (
                        <div
                          key={page.pageNum}
                          className="p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => openWritingModal(idx, pi)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-gray-500">P{page.pageNum}</span>
                            {feedbackOnPage.length > 0 && (
                              <span className="text-[9px] font-bold text-brand-primary bg-brand-tint px-1.5 rounded">첨삭 {feedbackOnPage.length}</span>
                            )}
                          </div>
                          <div className="w-full bg-gray-50 border border-gray-100 rounded overflow-hidden" style={{ aspectRatio: '210 / 297' }}>
                            <HandwritingThumbnail seed={idx} studentName={student.nickname} pageNum={page.pageNum} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ── AI 분석 ── */}
        {viewTab === 'ai' && (
          <section className="flex flex-col gap-8 mb-16">

            {/* 세션 요약 분석 */}
            <div className="neo-card overflow-hidden">
              <div className="px-8 py-6 border-b border-app-border flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">수업 요약 분석</h2>
                  <span className="text-xs text-gray-400 mt-0.5 block">수업 전체 흐름, 핵심 개념, 질문 패턴을 분석합니다</span>
                </div>
                {!sessionAnalysis && !sessionAnalyzing && (
                  <button
                    onClick={startSessionAnalysis}
                    className="px-6 py-2.5 border-2 border-brand-primary text-brand-primary text-sm font-semibold rounded-full hover:bg-brand-primary hover:text-white transition-all"
                  >
                    AI 분석 시작
                  </button>
                )}
                {sessionAnalysis && !sessionAnalyzing && (
                  <button
                    onClick={resetSessionAnalysis}
                    className="px-4 py-1.5 text-xs font-medium text-gray-400 hover:text-brand-primary transition-colors"
                  >
                    재분석
                  </button>
                )}
              </div>

              {sessionAnalyzing && (
                <div className="px-8 py-12 flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-primary rounded-full animate-spin" />
                  <span className="text-sm text-gray-400">분석 중...</span>
                </div>
              )}

              {sessionAnalysis && (
                <div className="px-8 py-8 flex flex-col gap-8">
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-2">수업 흐름 요약</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{sessionAnalysis.summary}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-2">핵심 개념</h3>
                    <div className="flex flex-wrap gap-2">
                      {sessionAnalysis.keyConcepts.map(tag => (
                        <span key={tag} className="px-3 py-1.5 bg-brand-tint/30 text-gray-600 text-xs font-medium rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-2">질문 집중 구간</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{sessionAnalysis.questionHotspot}</p>
                  </div>

                  <div className="p-5 bg-brand-tint/30 rounded-xl">
                    <h3 className="text-sm font-bold text-gray-600 mb-2">다음 수업 권장사항</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{sessionAnalysis.nextClassRecommendation}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Q&A 타임라인 */}
            <div ref={timelineRef} className="neo-card overflow-hidden">
              <div className="px-8 py-6 border-b border-app-border">
                <h2 className="text-base font-bold text-gray-900">풀이 타임라인</h2>
                <span className="text-xs text-gray-400 mt-0.5 block">수업 중 발생한 질문, 답변, 첨삭 기록</span>
                {/* 필터 버튼 */}
                <div className="flex gap-2 mt-3">
                  {([['all', '전체'], ['questions', '질문'], ['feedback', '피드백']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setVoiceFilter(key)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        voiceFilter === key
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {studentFilter !== 'all' && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-tint text-brand-primary flex items-center gap-1">
                      {STUDENTS.find(s => s.userId === studentFilter)?.nickname ?? studentFilter}
                      <button onClick={() => setStudentFilter('all')} className="ml-1 hover:text-gray-600">&times;</button>
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-tint/20">
                      <th className="text-left px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest w-20">시간</th>
                      <th className="text-left px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest w-20">학생</th>
                      <th className="text-left px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">활동 내용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredEvents.map((event, i) => {
                      const { label, color } = getEventTypeLabel(event);
                      return (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-8 py-4 font-mono text-xs text-gray-400">{event.timestamp}</td>
                          <td className="px-4 py-4 text-xs font-medium text-gray-600">
                            {event.speaker === 'host' ? '선생님' : event.studentName}
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-600 leading-relaxed">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md mr-2 ${color}`}>{label}</span>
                            {event.transcript}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredEvents.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-8 py-8 text-center text-xs text-gray-400">
                          해당 조건의 이벤트가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 학생별 개인 분석 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">학생별 상세 분석</h3>
              <div className="flex flex-col gap-3">
                {STUDENTS.map(student => {
                  const isExpanded = expandedStudents.has(student.userId);
                  const totalRate = getStudentTotalRate(student.userId);
                  const analysis = studentAnalyses[student.userId];
                  const isAnalyzing = studentAnalyzing.has(student.userId);
                  const voiceEvents = getStudentVoiceEvents(student.nickname);
                  const initial = student.nickname.charAt(0);

                  return (
                    <div key={student.userId} className="neo-card overflow-hidden">
                      <button
                        onClick={() => toggleStudentExpand(student.userId)}
                        className="w-full flex items-center justify-between px-6 py-5 hover:bg-gray-50 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-brand-tint flex items-center justify-center text-brand-primary font-bold text-sm">
                            {initial}
                          </div>
                          <span className="text-sm font-semibold text-gray-800">{student.nickname}</span>
                          <span className="text-sm text-gray-400 font-medium">{totalRate}%</span>
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-300 group-hover:text-brand-primary transition-all ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="px-6 pb-6 flex flex-col gap-5 border-t border-app-border pt-4">

                          {voiceEvents.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">수업 활동</h4>
                              <div className="flex flex-col gap-1.5">
                                {voiceEvents.map((e, i) => {
                                  const { label, color } = getEventTypeLabel(e);
                                  return (
                                    <div key={i} className="flex items-start gap-3 text-xs">
                                      <span className="font-mono text-gray-400 flex-shrink-0 w-12">{e.timestamp}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${color}`}>{label}</span>
                                      <span className="text-gray-600 leading-relaxed">{e.transcript}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">필기 밀도</h4>
                            <div className="flex gap-4">
                              {PAGES_DATA.map(page => {
                                const s = page.students.find(st => st.userId === student.userId);
                                const rate = s ? getRate(s.strokeCount, s.maxStroke) : 0;
                                return (
                                  <div key={page.pageNum} className="flex items-center gap-2 text-xs">
                                    <span className="font-semibold text-gray-500">P{page.pageNum}</span>
                                    <div className="w-20 h-1.5 bg-brand-tint/40 rounded-full overflow-hidden">
                                      <div className={`h-full ${getRateBarColor(rate, rate > 0)}`} style={{ width: getRateBarWidth(rate) }} />
                                    </div>
                                    <span className="font-medium text-gray-400">{rate === 0 ? '—' : `${rate}%`}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {!analysis && !isAnalyzing && (
                            <button
                              onClick={() => startStudentAnalysis(student.userId)}
                              className="w-fit px-5 py-2 bg-brand-tint/30 text-gray-600 text-xs font-semibold rounded-lg hover:bg-brand-tint hover:text-brand-primary transition-colors"
                            >
                              개인 분석 생성
                            </button>
                          )}

                          {isAnalyzing && (
                            <div className="flex items-center gap-2 py-2">
                              <div className="w-4 h-4 border-2 border-gray-200 border-t-brand-primary rounded-full animate-spin" />
                              <span className="text-xs text-gray-400">분석 중...</span>
                            </div>
                          )}

                          {analysis && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-4 bg-app-bg rounded-xl">
                                <h4 className="text-xs font-bold text-gray-500 mb-1.5">학습 현황</h4>
                                <p className="text-xs text-gray-600 leading-relaxed">{analysis.currentStatus}</p>
                              </div>
                              <div className="p-4 bg-app-bg rounded-xl">
                                <h4 className="text-xs font-bold text-gray-500 mb-1.5">잘한 점</h4>
                                <p className="text-xs text-gray-600 leading-relaxed">{analysis.strengths}</p>
                              </div>
                              <div className="p-4 bg-app-bg rounded-xl">
                                <h4 className="text-xs font-bold text-gray-500 mb-1.5">보완 필요</h4>
                                <p className="text-xs text-gray-600 leading-relaxed">{analysis.improvements}</p>
                              </div>
                              <div className="p-4 bg-app-bg rounded-xl">
                                <h4 className="text-xs font-bold text-gray-500 mb-1.5">추천 학습법</h4>
                                <p className="text-xs text-gray-600 leading-relaxed">{analysis.studyRecommendation}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </section>
        )}

      </main>

      {/* ── 필기 리플레이 모달 ── */}
      {writingModal.open && (() => {
        const { studentIdx, pageIdx } = writingModal;
        const page = PAGES_DATA[pageIdx];
        const student = page?.students[studentIdx];
        const rate = student ? getRate(student.strokeCount, student.maxStroke) : 0;
        return (
          <div
            className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) closeWritingModal(); }}
          >
            <div className="bg-white rounded-2xl w-[90vw] max-w-[560px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                <div>
                  <div className="text-sm font-bold text-gray-900">{student?.nickname ?? ''} — P{pageIdx + 1}</div>
                </div>
                <button
                  onClick={closeWritingModal}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="닫기 (ESC)"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>
                </button>
              </div>

              {/* Canvas */}
              <div className="flex-1 overflow-y-auto flex items-center justify-center p-5 bg-gray-100">
                <div className="w-full max-w-[480px] bg-white border border-gray-200 rounded-lg overflow-hidden shadow-md" style={{ aspectRatio: '210 / 297' }}>
                  {student && student.strokeCount > 0 ? (
                    <HandwritingThumbnail seed={studentIdx} studentName={student.nickname} pageNum={pageIdx + 1} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-red-50">
                      <span className="text-sm font-semibold text-red-400">미필기</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => modalNavPage(-1)}
                    disabled={pageIdx === 0}
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 16l-6-6 6-6"/></svg>
                    이전
                  </button>
                  <button
                    onClick={() => modalNavPage(1)}
                    disabled={pageIdx === PAGES_DATA.length - 1}
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    다음
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 4l6 6-6 6"/></svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-primary rounded-full transition-all" style={{ width: `${replayState.progress}%` }} />
                  </div>
                  <button
                    onClick={toggleReplay}
                    disabled={rate === 0}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors flex items-center gap-1.5 ${
                      replayState.playing
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white'
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    {replayState.playing ? (
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><rect x="5" y="4" width="3.5" height="12" rx="1"/><rect x="11.5" y="4" width="3.5" height="12" rx="1"/></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4l10 6-10 6V4z"/></svg>
                    )}
                    {replayState.playing ? '일시정지' : replayState.progress >= 100 ? '재시작' : '리플레이'}
                  </button>
                  {replayState.progress > 0 && (
                    <button
                      onClick={stopReplay}
                      className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                      title="처음부터"
                    >
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10a6 6 0 1 1 1.5 4"/><path d="M4 15V10h5"/></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
