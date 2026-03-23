import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandwritingThumbnail } from '../components/HandwritingThumbnail';
import { VOICE_EVENTS } from '../data/voiceScenario';
import type { VoiceEvent } from '../data/voiceScenario';

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

// AI 분석 결과 타입
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

// 워크시트 정보
const WORKSHEET: WorksheetInfo = {
  filename: '중3_이차방정식_단원평가.pdf',
  pages: 3,
  uploadedAt: '2026-03-21',
  sobp: '3.27.168.1',
};

// 더미 학생 데이터 (5명)
const STUDENTS: Student[] = [
  { userId: 'guest_001', nickname: '박민준' },
  { userId: 'guest_002', nickname: '이서연' },
  { userId: 'guest_003', nickname: '최도윤' },
  { userId: 'guest_004', nickname: '정하은' },
  { userId: 'guest_005', nickname: '강지우' },
];

// 페이지별 더미 데이터
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

// 더미 AI 분석 결과 — 세션 전체
const DUMMY_SESSION_ANALYSIS: SessionAnalysis = {
  summary: '인수분해, 완전제곱식, 근의 공식 세 가지 풀이법을 순서대로 다룬 수업입니다. 판별식 개념(2페이지)과 허근(5페이지) 구간에서 학생 질문이 집중되었으며, 7페이지에서는 풀이법 간 관계에 대한 심화 질문이 있었습니다. 필기 데이터 기준 전체 평균 참여율은 68%이며, 후반부로 갈수록 필기 밀도가 높아졌습니다.',
  keyConcepts: ['판별식', '중근', '인수분해', '근의 공식', '완전제곱식', '허근'],
  questionHotspot: '2페이지(14:15)와 5페이지(14:38~14:42)에 질문이 집중되었습니다. 판별식 값에 따른 근의 분류가 한 번에 이해되지 않아 반복 확인이 필요했던 것으로 보입니다.',
  nextClassRecommendation: '판별식의 부호에 따라 포물선과 x축의 위치 관계가 어떻게 달라지는지 그래프로 비교하는 활동을 권장합니다. 부호 실수가 있는 학생에게는 근의 공식 대입 시 괄호 표기를 강조하는 연습 문제를 사전 배포하세요.',
};

// 더미 AI 분석 결과 — 학생별
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRate(strokeCount: number, maxStroke: number): number {
  if (maxStroke === 0) return 0;
  return Math.round((strokeCount / maxStroke) * 100);
}

function getRateColor(rate: number): string {
  if (rate < 40) return 'text-red-500';
  if (rate < 70) return 'text-amber-500';
  return 'text-emerald-600';
}

function getRateBarColor(rate: number): string {
  if (rate < 40) return 'bg-red-400';
  if (rate < 70) return 'bg-amber-400';
  return 'bg-emerald-500';
}

type ViewTab = 'page' | 'student' | 'ai';

// Q&A 타임라인 이벤트 타입 라벨
function getEventTypeLabel(e: VoiceEvent): { label: string; color: string } {
  if (e.type === 'explanation') return { label: '설명', color: 'bg-blue-100 text-blue-700' };
  if (e.type === 'question') return { label: '질문', color: 'bg-amber-100 text-amber-700' };
  if (e.type === 'answer') return { label: '답변', color: 'bg-emerald-100 text-emerald-700' };
  if (e.type === 'feedback') return { label: '첨삭', color: 'bg-rose-100 text-rose-700' };
  return { label: '', color: '' };
}

export function ArchiveDetailV2({ archive }: { archive: ArchiveItem }) {
  const navigate = useNavigate();
  const [viewTab, setViewTab] = useState<ViewTab>('page');
  const [openPages, setOpenPages] = useState<Set<number>>(new Set([1]));

  // AI 분석 상태
  const [sessionAnalysis, setSessionAnalysis] = useState<SessionAnalysis | null>(null);
  const [sessionAnalyzing, setSessionAnalyzing] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [studentAnalyses, setStudentAnalyses] = useState<Record<string, StudentAnalysis>>({});
  const [studentAnalyzing, setStudentAnalyzing] = useState<Set<string>>(new Set());

  const togglePage = (pageNum: number) => {
    setOpenPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  };

  const toggleStudentExpand = (userId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // 세션 AI 분석 시작 (더미 — 실제로는 Claude API 호출)
  const startSessionAnalysis = () => {
    setSessionAnalyzing(true);
    setTimeout(() => {
      setSessionAnalysis(DUMMY_SESSION_ANALYSIS);
      setSessionAnalyzing(false);
    }, 2000);
  };

  // 학생 AI 분석 시작 (더미)
  const startStudentAnalysis = (userId: string) => {
    setStudentAnalyzing(prev => new Set(prev).add(userId));
    setTimeout(() => {
      setStudentAnalyses(prev => ({ ...prev, [userId]: DUMMY_STUDENT_ANALYSES[userId] }));
      setStudentAnalyzing(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }, 1500);
  };

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

  // 학생의 Q&A 이벤트 필터링
  const getStudentVoiceEvents = (nickname: string) => {
    return VOICE_EVENTS.filter(e => e.studentName === nickname || (e.type === 'feedback' && e.transcript.includes(nickname)));
  };

  return (
    <div className="min-h-screen bg-app-bg text-slate-800 font-noto overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-10 py-16 flex flex-col gap-10">

        {/* 헤더 */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-1.5 text-slate-400 font-bold text-sm hover:text-brand-primary transition-colors w-fit group"
          >
            <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            뒤로가기
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{archive.sessionName}</h1>
          <span className="text-sm text-slate-400 font-medium">
            {formatDate(archive.endedAt)} · {new Date(archive.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* 워크시트 정보 */}
        <div className="neo-card p-5 flex items-center justify-between bg-white/60 backdrop-blur-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-tint flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-800 truncate">{WORKSHEET.filename}</span>
              <span className="text-xs text-slate-400">{WORKSHEET.pages}페이지 · {WORKSHEET.uploadedAt} · SOBP {WORKSHEET.sobp}</span>
            </div>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="neo-card p-6 flex flex-col gap-1 border-b-4 border-b-brand-primary/20">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">수업 시간</span>
            <span className="text-3xl font-black text-brand-primary tracking-tighter">42분</span>
          </div>
          <div className="neo-card p-6 flex flex-col gap-1 border-b-4 border-b-brand-secondary/20">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">참여 학생</span>
            <span className="text-3xl font-black text-brand-secondary tracking-tighter">{STUDENTS.length}명</span>
          </div>
          <div className="neo-card p-6 flex flex-col gap-1 border-b-4 border-b-amber-300/20">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">평균 참여율</span>
            <span className="text-3xl font-black text-amber-500 tracking-tighter">
              {Math.round(STUDENTS.reduce((sum, s) => sum + getStudentTotalRate(s.userId), 0) / STUDENTS.length)}%
            </span>
          </div>
        </div>

        {/* 참여율 히트맵 */}
        <section className="neo-card overflow-hidden">
          <div className="px-6 py-4 border-b border-app-border">
            <h2 className="text-base font-bold text-slate-800">참여율 히트맵</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left px-6 py-3 font-bold text-slate-500 text-xs w-32">학생</th>
                  {PAGES_DATA.map(p => (
                    <th key={p.pageNum} className="text-center px-4 py-3 font-bold text-slate-500 text-xs">P{p.pageNum}</th>
                  ))}
                  <th className="text-center px-6 py-3 font-bold text-slate-700 text-xs">전체</th>
                </tr>
              </thead>
              <tbody>
                {STUDENTS.map(student => {
                  const totalRate = getStudentTotalRate(student.userId);
                  return (
                    <tr key={student.userId} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 font-bold text-slate-700">{student.nickname}</td>
                      {PAGES_DATA.map(page => {
                        const s = page.students.find(st => st.userId === student.userId);
                        const rate = s ? getRate(s.strokeCount, s.maxStroke) : 0;
                        return (
                          <td key={page.pageNum} className="px-4 py-3">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-full max-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${getRateBarColor(rate)}`}
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold ${getRateColor(rate)}`}>
                                {rate === 0 ? '미필기' : `${rate}%`}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-6 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-full max-w-[80px] h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${getRateBarColor(totalRate)}`}
                              style={{ width: `${totalRate}%` }}
                            />
                          </div>
                          <span className={`text-xs font-black ${getRateColor(totalRate)}`}>{totalRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 뷰 탭 */}
        <div className="flex gap-1 p-1 bg-white border border-app-border rounded-2xl w-fit">
          {[
            { key: 'page' as const, label: '페이지별 보기' },
            { key: 'student' as const, label: '학생별 보기' },
            { key: 'ai' as const, label: 'AI 분석' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setViewTab(tab.key)}
              className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${
                viewTab === tab.key
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── 페이지별 보기 ─── */}
        {viewTab === 'page' && (
          <section className="flex flex-col gap-4">
            {PAGES_DATA.map(page => {
              const isOpen = openPages.has(page.pageNum);
              const doneCount = page.students.filter(s => s.strokeCount > 0).length;
              const cols = Math.max(page.students.length, 3);

              return (
                <div key={page.pageNum} className="neo-card overflow-hidden">
                  <button
                    onClick={() => togglePage(page.pageNum)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-brand-primary bg-brand-tint rounded-lg px-3 py-1">
                        P{page.pageNum}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">학생 {page.students.length}명</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-400 font-medium">
                        {doneCount}명 <span className="font-bold text-emerald-600">완료</span>
                      </span>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-2 border-t border-app-border">
                      <div
                        className="grid gap-4"
                        style={{ gridTemplateColumns: `repeat(${Math.min(cols, 5)}, 1fr)` }}
                      >
                        {page.students.map((student, idx) => {
                          const rate = getRate(student.strokeCount, student.maxStroke);
                          return (
                            <div
                              key={student.userId}
                              className="flex flex-col gap-2 bg-white border border-slate-100 rounded-2xl overflow-hidden hover:border-brand-primary/30 transition-colors"
                            >
                              <div className="px-3 pt-2 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700">{student.nickname}</span>
                                {rate > 0 ? (
                                  <span className="text-[10px] font-bold text-emerald-600">완료</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-red-500">미필기</span>
                                )}
                              </div>
                              <div className="w-full bg-slate-50 mx-auto" style={{ aspectRatio: '210 / 297' }}>
                                <HandwritingThumbnail seed={idx} studentName={student.nickname} pageNum={page.pageNum} />
                              </div>
                              <div className="px-3 pb-3 flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${getRateBarColor(rate)}`}
                                      style={{ width: `${rate}%` }}
                                    />
                                  </div>
                                  <span className={`text-[10px] font-bold ${getRateColor(rate)}`}>
                                    {rate === 0 ? '미필기' : `${rate}%`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* ─── 학생별 보기 ─── */}
        {viewTab === 'student' && (
          <section className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STUDENTS.map((student, idx) => {
                const totalRate = getStudentTotalRate(student.userId);
                return (
                  <button
                    key={student.userId}
                    onClick={() => navigate(`/replay/guest/${archive.archiveId}/${student.userId}`)}
                    className="group relative bg-white rounded-modern overflow-hidden transition-all duration-300 text-left border-2 border-app-border hover:-translate-y-1 hover:shadow-modern hover:border-brand-primary/30"
                    style={{ height: '420px' }}
                  >
                    <div className="absolute inset-x-0 top-0 bottom-[56px] bg-slate-50 overflow-hidden">
                      <HandwritingThumbnail seed={idx} studentName={student.nickname} pageNum={1} />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-[56px] bg-white border-t border-app-border px-5 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">{student.nickname}</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getRateBarColor(totalRate)}`} />
                        <span className={`text-xs font-bold ${getRateColor(totalRate)}`}>{totalRate}%</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── AI 분석 ─── */}
        {viewTab === 'ai' && (
          <section className="flex flex-col gap-8">

            {/* 1. 세션 요약 분석 */}
            <div className="neo-card overflow-hidden">
              <div className="px-6 py-4 border-b border-app-border flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base font-bold text-slate-800">수업 요약 분석</h2>
                  <span className="text-xs text-slate-400">수업 전체 흐름, 핵심 개념, 질문 패턴을 분석합니다</span>
                </div>
                {!sessionAnalysis && !sessionAnalyzing && (
                  <button
                    onClick={startSessionAnalysis}
                    className="px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-primary/90 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI 분석 시작
                  </button>
                )}
              </div>

              {/* 로딩 */}
              {sessionAnalyzing && (
                <div className="px-6 py-12 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                  <span className="text-sm text-slate-400 font-medium">수업 내용을 분석하고 있습니다...</span>
                </div>
              )}

              {/* 분석 결과 */}
              {sessionAnalysis && (
                <div className="px-6 py-6 flex flex-col gap-6">
                  {/* 수업 흐름 요약 */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-slate-700">수업 흐름 요약</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{sessionAnalysis.summary}</p>
                  </div>

                  {/* 핵심 개념 태그 */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-slate-700">핵심 개념</h3>
                    <div className="flex flex-wrap gap-2">
                      {sessionAnalysis.keyConcepts.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-brand-tint text-brand-primary text-xs font-bold rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 질문 집중 구간 */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-slate-700">질문 집중 구간</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{sessionAnalysis.questionHotspot}</p>
                  </div>

                  {/* 다음 수업 권장 */}
                  <div className="flex flex-col gap-2 p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <h3 className="text-sm font-bold text-amber-700">다음 수업 권장사항</h3>
                    <p className="text-sm text-amber-800 leading-relaxed">{sessionAnalysis.nextClassRecommendation}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Q&A 타임라인 — 항상 노출 */}
            <div className="neo-card overflow-hidden">
              <div className="px-6 py-4 border-b border-app-border">
                <h2 className="text-base font-bold text-slate-800">Q&A 타임라인</h2>
                <span className="text-xs text-slate-400">수업 중 발생한 질문, 답변, 첨삭 기록</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="text-left px-6 py-3 font-bold text-slate-500 text-xs w-16">시간</th>
                      <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs w-14">페이지</th>
                      <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs w-16">유형</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs w-20">발화자</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs">내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {VOICE_EVENTS.map((event, i) => {
                      const { label, color } = getEventTypeLabel(event);
                      return (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 font-mono text-xs text-slate-500">{event.timestamp}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-bold text-brand-primary">P{event.pageNumber}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${color}`}>{label}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-700">
                            {event.speaker === 'host' ? '선생님' : event.studentName}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 leading-relaxed">{event.transcript}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. 학생별 개인 분석 */}
            <div className="neo-card overflow-hidden">
              <div className="px-6 py-4 border-b border-app-border">
                <h2 className="text-base font-bold text-slate-800">학생별 개인 분석</h2>
                <span className="text-xs text-slate-400">학생을 선택하여 개인 리포트를 생성할 수 있습니다</span>
              </div>
              <div className="flex flex-col">
                {STUDENTS.map(student => {
                  const isExpanded = expandedStudents.has(student.userId);
                  const totalRate = getStudentTotalRate(student.userId);
                  const analysis = studentAnalyses[student.userId];
                  const isAnalyzing = studentAnalyzing.has(student.userId);
                  const voiceEvents = getStudentVoiceEvents(student.nickname);

                  return (
                    <div key={student.userId} className="border-t border-slate-100 first:border-t-0">
                      {/* 학생 헤더 — 클릭으로 확장 */}
                      <button
                        onClick={() => toggleStudentExpand(student.userId)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-800">{student.nickname}</span>
                          <span className={`text-xs font-bold ${getRateColor(totalRate)}`}>{totalRate}%</span>
                          {voiceEvents.length > 0 && (
                            <span className="text-[10px] text-slate-400 font-medium">질문 {voiceEvents.filter(e => e.type === 'question').length}건</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {analysis && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">분석 완료</span>
                          )}
                          <svg
                            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* 확장 — 상세 분석 */}
                      {isExpanded && (
                        <div className="px-6 pb-6 flex flex-col gap-4">

                          {/* 이 학생의 Q&A */}
                          {voiceEvents.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <h4 className="text-xs font-bold text-slate-500">이 학생의 수업 활동</h4>
                              <div className="flex flex-col gap-1.5">
                                {voiceEvents.map((e, i) => {
                                  const { label, color } = getEventTypeLabel(e);
                                  return (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                      <span className="font-mono text-slate-400 flex-shrink-0">{e.timestamp}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${color}`}>{label}</span>
                                      <span className="text-slate-600">{e.transcript}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 필기 밀도 요약 */}
                          <div className="flex flex-col gap-2">
                            <h4 className="text-xs font-bold text-slate-500">필기 밀도</h4>
                            <div className="flex gap-3">
                              {PAGES_DATA.map(page => {
                                const s = page.students.find(st => st.userId === student.userId);
                                const rate = s ? getRate(s.strokeCount, s.maxStroke) : 0;
                                return (
                                  <div key={page.pageNum} className="flex items-center gap-1.5 text-xs">
                                    <span className="font-bold text-brand-primary">P{page.pageNum}</span>
                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${getRateBarColor(rate)}`} style={{ width: `${rate}%` }} />
                                    </div>
                                    <span className={`font-bold ${getRateColor(rate)}`}>{rate === 0 ? '미필기' : `${rate}%`}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* AI 분석 버튼 or 결과 */}
                          {!analysis && !isAnalyzing && (
                            <button
                              onClick={() => startStudentAnalysis(student.userId)}
                              className="w-fit px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-brand-tint hover:text-brand-primary transition-colors flex items-center gap-2"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              개인 분석 생성
                            </button>
                          )}

                          {isAnalyzing && (
                            <div className="flex items-center gap-2 py-2">
                              <div className="w-4 h-4 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                              <span className="text-xs text-slate-400">분석 중...</span>
                            </div>
                          )}

                          {analysis && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5 p-4 bg-slate-50 rounded-xl">
                                <h4 className="text-xs font-bold text-slate-500">학습 현황</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">{analysis.currentStatus}</p>
                              </div>
                              <div className="flex flex-col gap-1.5 p-4 bg-emerald-50 rounded-xl">
                                <h4 className="text-xs font-bold text-emerald-700">잘한 점</h4>
                                <p className="text-xs text-emerald-800 leading-relaxed">{analysis.strengths}</p>
                              </div>
                              <div className="flex flex-col gap-1.5 p-4 bg-amber-50 rounded-xl">
                                <h4 className="text-xs font-bold text-amber-700">보완 필요</h4>
                                <p className="text-xs text-amber-800 leading-relaxed">{analysis.improvements}</p>
                              </div>
                              <div className="flex flex-col gap-1.5 p-4 bg-blue-50 rounded-xl">
                                <h4 className="text-xs font-bold text-blue-700">추천 학습법</h4>
                                <p className="text-xs text-blue-800 leading-relaxed">{analysis.studyRecommendation}</p>
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

      </div>
    </div>
  );
}
