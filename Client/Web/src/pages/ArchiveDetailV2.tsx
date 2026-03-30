import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HandwritingThumbnail } from '../components/HandwritingThumbnail';
import { ANNOTATION_EVENTS, DUMMY_VOICE_ANALYSIS } from '../data/voiceScenario';
import type { VoiceAnalysis, Locale as VoiceLocale } from '../data/voiceScenario';
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

// v1: 필기 패턴 기반 분석만 (내용 분석은 v2 — AI Vision 도입 후)
interface SessionAnalysis {
  participationSummary: string;
  pageDropoff: string;
  annotationSummary: string;
  voiceAnalysis: VoiceAnalysis;  // STT 기반 음성 분석 (v1.1 확장)
}

interface StudentAnalysis {
  pattern: string;             // 필기 패턴 요약
  annotationResponse: string;  // 첨삭 후 반응 (재필기 여부)
  attention: string;           // 주의 포인트
}

const WORKSHEET: WorksheetInfo = {
  filename: '중3_이차방정식_단원평가.pdf',
  pages: 3,
  uploadedAt: '2026-03-21',
  sobp: '3.27.168.1',
};

/** locale → 학생 이름 매핑 */
const STUDENT_NAMES: Record<string, Record<string, string>> = {
  ko: { guest_001: '박민준', guest_002: '이서연', guest_003: '최도윤', guest_004: '정하은', guest_005: '강지우' },
  ja: { guest_001: '田中 悠真', guest_002: '鈴木 美咲', guest_003: '高橋 蓮', guest_004: '伊藤 結衣', guest_005: '佐藤 陽菜' },
  en: { guest_001: 'Alex K.', guest_002: 'Emily S.', guest_003: 'James T.', guest_004: 'Mia L.', guest_005: 'Sarah H.' },
  'zh-TW': { guest_001: '王大明', guest_002: '林美玲', guest_003: '陳志偉', guest_004: '李怡君', guest_005: '張小華' },
};

function getStudentName(locale: string, userId: string): string {
  const lang = STUDENT_NAMES[locale] ? locale : 'ko';
  return STUDENT_NAMES[lang]?.[userId] ?? STUDENT_NAMES.ko[userId] ?? userId;
}

function getStudents(locale: string): Student[] {
  return [
    { userId: 'guest_001', nickname: getStudentName(locale, 'guest_001') },
    { userId: 'guest_002', nickname: getStudentName(locale, 'guest_002') },
    { userId: 'guest_003', nickname: getStudentName(locale, 'guest_003') },
    { userId: 'guest_004', nickname: getStudentName(locale, 'guest_004') },
    { userId: 'guest_005', nickname: getStudentName(locale, 'guest_005') },
  ];
}

const PAGE_TITLES: Record<string, string[]> = {
  ko: ['근의 공식 유도 및 예제', '판별식 활용 문제', '종합 서술형 풀이', '근과 계수의 관계', '이차방정식의 활용', '종합 연습 문제', '심화 서술형'],
  ja: ['解の公式の導出と例題', '判別式の活用問題', '総合記述問題', '解と係数の関係', '二次方程式の応用', '総合練習問題', '発展記述問題'],
  en: ['Quadratic Formula Derivation', 'Discriminant Problems', 'Comprehensive Written', 'Roots & Coefficients', 'Applications', 'Mixed Practice', 'Advanced Written'],
  'zh-TW': ['公式解推導與例題', '判別式應用題', '綜合論述題', '根與係數關係', '一元二次方程式應用', '綜合練習題', '進階論述題'],
};

// 획수 데이터 (locale 무관 — 숫자)
const STROKE_DATA = [
  [127, 148, 63, 112, 0],
  [89, 134, 41, 121, 72],
  [95, 52, 18, 110, 0],
  [88, 45, 0, 105, 30],
  [102, 38, 0, 120, 0],
  [76, 31, 0, 98, 0],
  [65, 0, 0, 91, 0],
];
const MAX_STROKES = [148, 134, 110, 105, 120, 98, 91];
const STUDENT_IDS = ['guest_001', 'guest_002', 'guest_003', 'guest_004', 'guest_005'];

function getPagesData(locale: string): PageData[] {
  const titles = PAGE_TITLES[locale] ?? PAGE_TITLES.ko;
  return titles.map((title, i) => ({
    pageNum: i + 1,
    title,
    students: STUDENT_IDS.map((id, j) => ({
      userId: id,
      nickname: getStudentName(locale, id),
      strokeCount: STROKE_DATA[i][j],
      maxStroke: MAX_STROKES[i],
    })),
  }));
}

// v1 더미: locale별 세션 분석 데이터
function getVoiceLocale(lang: string): VoiceLocale {
  if (lang === 'ja') return 'ja';
  if (lang === 'zh-TW') return 'zh-TW';
  if (lang.startsWith('en')) return 'en';
  return 'ko';
}

const SESSION_ANALYSIS_I18N: Record<string, Omit<SessionAnalysis, 'voiceAnalysis'>> = {
  ko: {
    participationSummary: '5명 중 4명이 P1에서 필기를 시작했으며, P2에서는 전원이 필기했습니다. P3에서 다시 1명(강지우)이 미필기로 전환되었습니다. 정하은과 박민준은 전 페이지에서 학급 평균 이상의 필기량을 유지했고, 최도윤은 전 페이지에서 학급 평균을 밑돌았습니다.',
    pageDropoff: '학급 평균 필기량이 P1 113획 → P2 91획 → P3 69획으로 페이지가 진행될수록 감소했습니다. 이서연은 P1 148획에서 P3 52획으로 가장 큰 감소 폭을 보였고, 최도윤은 P1 63획에서 P3 18획으로 지속 감소했습니다. 강지우는 P2(72획)에서만 필기가 확인되며 P1, P3은 미필기입니다.',
    annotationSummary: '총 5건의 첨삭이 4명에게 이루어졌습니다. 박민준 2건(P1, P3), 이서연 1건(P2), 최도윤 1건(P3), 강지우 1건(P1). 정하은은 첨삭 없이 전 페이지를 완료했습니다. 첨삭 후 추가 필기가 확인된 경우는 3건(박민준 P1·P3, 이서연 P2)이며, 2건(최도윤 P3, 강지우 P1)은 첨삭 후에도 추가 필기가 없었습니다.',
  },
  ja: {
    participationSummary: '5名中4名がP1で筆記を開始し、P2では全員が筆記しました。P3では再び1名（佐藤 陽菜）が未筆記に転じました。伊藤 結衣と田中 悠真は全ページでクラス平均以上の筆記量を維持し、高橋 蓮は全ページでクラス平均を下回りました。',
    pageDropoff: 'クラス平均筆記量がP1 113画 → P2 91画 → P3 69画とページが進むにつれ減少しました。鈴木 美咲はP1 148画からP3 52画へ最大の減少幅を示し、高橋 蓮はP1 63画からP3 18画へ持続的に減少しました。佐藤 陽菜はP2（72画）のみ筆記が確認され、P1・P3は未筆記です。',
    annotationSummary: '合計5件の添削が4名に行われました。田中 悠真 2件（P1, P3）、鈴木 美咲 1件（P2）、高橋 蓮 1件（P3）、佐藤 陽菜 1件（P1）。伊藤 結衣は添削なしで全ページを完了しました。添削後の追加筆記が確認されたのは3件（田中 P1·P3、鈴木 P2）で、2件（高橋 P3、佐藤 P1）は添削後も追加筆記がありませんでした。',
  },
};

function getDummySessionAnalysis(locale: string): SessionAnalysis {
  const lang = SESSION_ANALYSIS_I18N[locale] ? locale : 'ko';
  const vl = getVoiceLocale(locale);
  return {
    ...SESSION_ANALYSIS_I18N[lang],
    voiceAnalysis: DUMMY_VOICE_ANALYSIS[vl],
  };
}

const STUDENT_ANALYSES_I18N: Record<string, Record<string, StudentAnalysis>> = {
  ko: {
    guest_001: {
      pattern: 'P1 127획, P2 89획, P3 95획. 전 페이지에서 필기했으며 학급 평균(P1 113, P2 91, P3 69)과 비교해 P1·P3은 평균 이상, P2는 평균에 근접합니다.',
      annotationResponse: 'P1과 P3에서 각 1건의 첨삭을 받았습니다. 두 경우 모두 첨삭 이후 추가 필기가 확인되었습니다(P1: 20획, P3: 15획).',
      attention: '별도 주의 사항 없음. 전 페이지 필기 및 첨삭 후 추가 필기 모두 확인됨.',
    },
    guest_002: {
      pattern: 'P1 148획, P2 134획, P3 52획. P1~P2에서 학급 내 최고 필기량을 기록했으나, P3에서 52획으로 크게 줄어 학급 평균(69획) 아래로 내려갔습니다.',
      annotationResponse: 'P2에서 1건의 첨삭을 받았으며, 이후 8획의 추가 필기가 확인되었습니다.',
      attention: 'P3 필기량이 P1 대비 크게 감소했습니다. 후반부 참여 저하 여부 확인이 필요합니다.',
    },
    guest_003: {
      pattern: 'P1 63획, P2 41획, P3 18획. 전 페이지에서 필기했으나, 필기량이 지속 감소했습니다. 세 페이지 모두 학급 평균을 크게 밑돌았습니다.',
      annotationResponse: 'P3에서 1건의 첨삭을 받았으나, 이후 추가 필기가 확인되지 않았습니다.',
      attention: '전 페이지에서 학급 평균 대비 낮은 필기량이며 지속 감소 중입니다. 개별 확인이 필요합니다.',
    },
    guest_004: {
      pattern: 'P1 112획, P2 121획, P3 110획. 전 페이지에서 안정적인 필기량을 유지했으며, 세 페이지 모두 학급 평균을 상회합니다.',
      annotationResponse: '첨삭을 받지 않았습니다.',
      attention: '별도 주의 사항 없음.',
    },
    guest_005: {
      pattern: 'P1 0획, P2 72획, P3 0획. P2에서만 필기 활동이 있었으며 학급 평균(91획)의 79% 수준입니다. P1과 P3은 미필기입니다.',
      annotationResponse: 'P1에서 1건의 첨삭을 받았으나, 해당 페이지에서 이후 추가 필기는 확인되지 않았습니다.',
      attention: '3페이지 중 2페이지 미필기. 수업 참여에 어려움이 있는지 확인이 필요합니다.',
    },
  },
  ja: {
    guest_001: {
      pattern: 'P1 127画、P2 89画、P3 95画。全ページで筆記しており、クラス平均（P1 113、P2 91、P3 69）と比較してP1·P3は平均以上、P2は平均に近いです。',
      annotationResponse: 'P1とP3でそれぞれ1件の添削を受けました。いずれも添削後に追加筆記が確認されました（P1: 20画、P3: 15画）。',
      attention: '特に注意事項なし。全ページ筆記および添削後の追加筆記を確認。',
    },
    guest_002: {
      pattern: 'P1 148画、P2 134画、P3 52画。P1〜P2でクラス最高の筆記量を記録しましたが、P3では52画に大幅減少し、クラス平均（69画）を下回りました。',
      annotationResponse: 'P2で1件の添削を受け、その後8画の追加筆記が確認されました。',
      attention: 'P3の筆記量がP1対比で大幅に減少。後半の参加低下の確認が必要です。',
    },
    guest_003: {
      pattern: 'P1 63画、P2 41画、P3 18画。全ページで筆記しましたが、筆記量が持続的に減少。3ページすべてでクラス平均を大きく下回りました。',
      annotationResponse: 'P3で1件の添削を受けましたが、その後の追加筆記は確認されませんでした。',
      attention: '全ページでクラス平均対比低い筆記量で持続減少中。個別確認が必要です。',
    },
    guest_004: {
      pattern: 'P1 112画、P2 121画、P3 110画。全ページで安定した筆記量を維持し、3ページすべてでクラス平均を上回っています。',
      annotationResponse: '添削を受けていません。',
      attention: '特に注意事項なし。',
    },
    guest_005: {
      pattern: 'P1 0画、P2 72画、P3 0画。P2のみ筆記活動があり、クラス平均（91画）の79%水準です。P1とP3は未筆記です。',
      annotationResponse: 'P1で1件の添削を受けましたが、そのページでの追加筆記は確認されませんでした。',
      attention: '3ページ中2ページ未筆記。授業参加に困難がないか確認が必要です。',
    },
  },
};

function getDummyStudentAnalyses(locale: string): Record<string, StudentAnalysis> {
  return STUDENT_ANALYSES_I18N[locale] ?? STUDENT_ANALYSES_I18N.ko;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function getRate(strokeCount: number, maxStroke: number): number {
  if (maxStroke === 0) return 0;
  return Math.round((strokeCount / maxStroke) * 100);
}

// ── 필기 상태 도트맵 ──
// 학급 평균 대비 40% 미만이면 '부진', 0이면 '미필기', 그 외 '필기'
type WritingStatus = 'wrote' | 'low' | 'none';

function getWritingStatus(strokeCount: number, classAvg: number): WritingStatus {
  if (strokeCount === 0) return 'none';
  if (classAvg > 0 && strokeCount < classAvg * 0.4) return 'low';
  return 'wrote';
}

function getStatusDot(status: WritingStatus): { color: string; labelKey: string } {
  switch (status) {
    case 'wrote': return { color: 'bg-brand-primary', labelKey: 'archiveDetail.writing' };
    case 'low':   return { color: 'bg-amber-400', labelKey: 'archiveDetail.poor' };
    case 'none':  return { color: 'bg-gray-200', labelKey: 'archiveDetail.noWriting' };
  }
}

function getPageClassAvg(page: PageData): number {
  const writers = page.students.filter(s => s.strokeCount > 0);
  if (writers.length === 0) return 0;
  return writers.reduce((sum, s) => sum + s.strokeCount, 0) / writers.length;
}

// 학생 전체 요약 상태 — pages 파라미터로 variant 지원
function getStudentSummary(userId: string, pages: PageData[]): { writtenPages: number; totalPages: number; status: string; count?: number } {
  const totalPages = pages.length;
  let writtenPages = 0;
  let lowPages = 0;
  pages.forEach(page => {
    const s = page.students.find(st => st.userId === userId);
    if (s && s.strokeCount > 0) {
      writtenPages++;
      const avg = getPageClassAvg(page);
      if (avg > 0 && s.strokeCount < avg * 0.4) lowPages++;
    }
  });
  if (writtenPages === 0) return { writtenPages, totalPages, status: 'noParticipation' };
  if (writtenPages === totalPages && lowPages === 0) return { writtenPages, totalPages, status: 'stable' };
  if (writtenPages < totalPages) return { writtenPages, totalPages, status: 'noWritingN', count: totalPages - writtenPages };
  if (lowPages > 0) return { writtenPages, totalPages, status: 'poorN', count: lowPages };
  return { writtenPages, totalPages, status: 'stable' };
}

type ViewTab = 'page' | 'student' | 'ai';
// v1: 이벤트 테이블 미사용 — 음성은 STT 요약 블록으로 대체

// 시안B 더미 데이터: 3명, 5페이지
const SIMPLE_STUDENTS: Student[] = [
  { userId: 'sg_001', nickname: '김민서' },
  { userId: 'sg_002', nickname: '이준호' },
  { userId: 'sg_003', nickname: '박서윤' },
];

const SIMPLE_PAGES: PageData[] = [
  { pageNum: 1, title: '1단원 기초', students: [
    { userId: 'sg_001', nickname: '김민서', strokeCount: 95, maxStroke: 120 },
    { userId: 'sg_002', nickname: '이준호', strokeCount: 78, maxStroke: 120 },
    { userId: 'sg_003', nickname: '박서윤', strokeCount: 110, maxStroke: 120 },
  ]},
  { pageNum: 2, title: '1단원 응용', students: [
    { userId: 'sg_001', nickname: '김민서', strokeCount: 88, maxStroke: 105 },
    { userId: 'sg_002', nickname: '이준호', strokeCount: 62, maxStroke: 105 },
    { userId: 'sg_003', nickname: '박서윤', strokeCount: 105, maxStroke: 105 },
  ]},
  { pageNum: 3, title: '2단원 기초', students: [
    { userId: 'sg_001', nickname: '김민서', strokeCount: 72, maxStroke: 98 },
    { userId: 'sg_002', nickname: '이준호', strokeCount: 45, maxStroke: 98 },
    { userId: 'sg_003', nickname: '박서윤', strokeCount: 91, maxStroke: 98 },
  ]},
  { pageNum: 4, title: '2단원 응용', students: [
    { userId: 'sg_001', nickname: '김민서', strokeCount: 60, maxStroke: 88 },
    { userId: 'sg_002', nickname: '이준호', strokeCount: 0, maxStroke: 88 },
    { userId: 'sg_003', nickname: '박서윤', strokeCount: 88, maxStroke: 88 },
  ]},
  { pageNum: 5, title: '종합 문제', students: [
    { userId: 'sg_001', nickname: '김민서', strokeCount: 55, maxStroke: 95 },
    { userId: 'sg_002', nickname: '이준호', strokeCount: 0, maxStroke: 95 },
    { userId: 'sg_003', nickname: '박서윤', strokeCount: 82, maxStroke: 95 },
  ]},
];

const SIMPLE_ANNOTATIONS = [
  { timestamp: '14:15', pageNumber: 2, targetStudentName: '이준호', studentRewriteAfter: 10 },
  { timestamp: '14:30', pageNumber: 3, targetStudentName: '이준호', studentRewriteAfter: 0 },
];

export function ArchiveDetailV2({ archive, variant = 'full' }: { archive: ArchiveItem; variant?: 'full' | 'simple' }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language;
  const isSimple = variant === 'simple';
  const activeStudents = isSimple ? SIMPLE_STUDENTS : getStudents(locale);
  const activePages = isSimple ? SIMPLE_PAGES : getPagesData(locale);
  const activeAnnotations = isSimple ? SIMPLE_ANNOTATIONS : ANNOTATION_EVENTS;
  const [viewTab, setViewTab] = useState<ViewTab>('page');
  const [sessionAnalysis, setSessionAnalysis] = useState<SessionAnalysis | null>(null);
  const [sessionAnalyzing, setSessionAnalyzing] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [studentAnalyses, setStudentAnalyses] = useState<Record<string, StudentAnalysis>>({});
  const [studentAnalyzing, setStudentAnalyzing] = useState<Set<string>>(new Set());

  // 필기 리플레이 모달
  const [writingModal, setWritingModal] = useState<{ open: boolean; studentIdx: number; pageIdx: number }>({ open: false, studentIdx: 0, pageIdx: 0 });
  const [replayState, setReplayState] = useState<{ playing: boolean; progress: number }>({ playing: false, progress: 0 });
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 4>(1);
  const replayTimerRef = useRef<number | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const REPLAY_DURATION_SEC = 32; // 더미 총 재생 시간

  // v1: 이벤트 테이블 제거, 관련 필터 미사용

  // 캐시에서 이전 분석 결과 복원
  useEffect(() => {
    const cache = getAnalysisCache(archive.archiveId);
    if (cache?.sessionResult) {
      try {
        const parsed = JSON.parse(cache.sessionResult);
        // 이전 형식(voiceSummary: string) 캐시는 무시 — 새 voiceAnalysis 구조 필요
        if (parsed.voiceAnalysis && typeof parsed.voiceAnalysis === 'object') {
          setSessionAnalysis(parsed);
        } else {
          clearAnalysisCache(archive.archiveId);
        }
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
      const analysis = getDummySessionAnalysis(locale);
      setSessionAnalysis(analysis);
      setSessionAnalyzing(false);
      setAnalysisCache(archive.archiveId, {
        sessionResult: JSON.stringify(analysis),
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
      const result = getDummyStudentAnalyses(locale)[userId];
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
      if (newPi < 0 || newPi >= activePages.length) return prev;
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

  // 재생 시간 포맷 (초 → mm:ss)
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startReplay = (fromProgress = 0) => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { studentIdx, pageIdx } = writingModal;
    const student = activePages[pageIdx]?.students[studentIdx];
    if (!student || student.strokeCount === 0) return;

    const hwIdx = studentIdx % 5;
    const pgIdx = pageIdx % 3;
    const hw = (window as any).__HANDWRITING_SETS?.[hwIdx]?.[pgIdx];
    if (!hw || !hw.lines || hw.lines.length === 0) return;

    const allChars: string[] = [];
    hw.lines.forEach((line: string) => {
      for (const ch of line) allChars.push(ch);
      allChars.push('\n');
    });

    const startIdx = Math.floor((fromProgress / 100) * allChars.length);
    setReplayState({ playing: true, progress: fromProgress });
    let idx = startIdx;

    const drawUpTo = (targetIdx: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, canvas.width, 110);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(canvas.width, 110); ctx.stroke();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      for (let y = 80; y < canvas.height; y += 36) {
        ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(canvas.width - 20, y); ctx.stroke();
      }
      ctx.fillStyle = '#1a1a2e';
      ctx.font = '20px "Noto Sans KR", sans-serif';
      let lineNum = 0;
      let charInLine = 0;
      for (let c = 0; c <= targetIdx && c < allChars.length; c++) {
        if (allChars[c] === '\n') { lineNum++; charInLine = 0; }
        else {
          const xJitter = ((studentIdx * 7 + lineNum * 3) % 5) - 2;
          ctx.fillText(allChars[c], 30 + xJitter + charInLine * 12, 290 + lineNum * 42);
          charInLine++;
        }
      }
    };

    const tick = () => {
      if (idx >= allChars.length) {
        drawUpTo(allChars.length - 1);
        setReplayState({ playing: false, progress: 100 });
        return;
      }
      const progress = Math.round((idx / allChars.length) * 100);
      setReplayState(prev => prev.playing ? { playing: true, progress } : prev);
      drawUpTo(idx);
      idx += 2 * replaySpeed;
      replayTimerRef.current = window.setTimeout(tick, 50);
    };

    // 초기 프레임을 바로 그려줌
    if (startIdx > 0) drawUpTo(startIdx);
    tick();
  };

  const toggleReplay = () => {
    if (replayState.playing) {
      if (replayTimerRef.current) { clearTimeout(replayTimerRef.current); replayTimerRef.current = null; }
      setReplayState(prev => ({ ...prev, playing: false }));
    } else {
      if (replayState.progress >= 100) {
        stopReplay();
        setTimeout(() => startReplay(0), 50);
      } else {
        startReplay(replayState.progress);
      }
    }
  };

  const cycleSpeed = () => {
    setReplaySpeed(prev => prev === 1 ? 2 : prev === 2 ? 4 : 1);
  };

  const skipReplay = (deltaSec: number) => {
    const deltaPercent = (deltaSec / REPLAY_DURATION_SEC) * 100;
    const newProgress = Math.max(0, Math.min(100, replayState.progress + deltaPercent));
    if (replayState.playing) {
      if (replayTimerRef.current) { clearTimeout(replayTimerRef.current); replayTimerRef.current = null; }
      startReplay(newProgress);
    } else {
      setReplayState({ playing: false, progress: newProgress });
      // 정지 상태에서도 캔버스 업데이트
      const canvas = modalCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { studentIdx, pageIdx } = writingModal;
          const hwIdx = studentIdx % 5;
          const pgIdx = pageIdx % 3;
          const hw = (window as any).__HANDWRITING_SETS?.[hwIdx]?.[pgIdx];
          if (hw?.lines) {
            const allChars: string[] = [];
            hw.lines.forEach((line: string) => { for (const ch of line) allChars.push(ch); allChars.push('\n'); });
            const targetIdx = Math.floor((newProgress / 100) * allChars.length);
            // 간이 렌더
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, canvas.width, 110);
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(canvas.width, 110); ctx.stroke();
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
            for (let y = 80; y < canvas.height; y += 36) { ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(canvas.width - 20, y); ctx.stroke(); }
            ctx.fillStyle = '#1a1a2e'; ctx.font = '20px "Noto Sans KR", sans-serif';
            let lineNum = 0, charInLine = 0;
            for (let c = 0; c <= targetIdx && c < allChars.length; c++) {
              if (allChars[c] === '\n') { lineNum++; charInLine = 0; }
              else { const xJ = ((studentIdx * 7 + lineNum * 3) % 5) - 2; ctx.fillText(allChars[c], 30 + xJ + charInLine * 12, 290 + lineNum * 42); charInLine++; }
            }
          }
        }
      }
    }
  };

  const seekReplay = (percent: number) => {
    const clamped = Math.max(0, Math.min(100, percent));
    if (replayState.playing) {
      if (replayTimerRef.current) { clearTimeout(replayTimerRef.current); replayTimerRef.current = null; }
      startReplay(clamped);
    } else {
      skipReplay(((clamped - replayState.progress) / 100) * REPLAY_DURATION_SEC);
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

  // 전 페이지 필기 학생 수
  const allPageWriters = activeStudents.filter(s => getStudentSummary(s.userId, activePages).writtenPages === activePages.length).length;
  const totalAnnotations = activeAnnotations.length;

  return (
    <div className="min-h-screen bg-app-bg">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-16">

        {/* ── 헤더 ── */}
        <section className="mb-8">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center text-gray-400 hover:text-brand-primary mb-6 group transition-colors"
          >
            <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">{t('archiveDetail.backToList')}</span>
          </button>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">
            {archive.sessionName}
          </h1>
          <span className="text-gray-400 text-sm font-medium">{formatDate(archive.endedAt)}</span>
        </section>

        {/* ── 워크시트 정보 ── */}
        <section className="mb-6 flex items-center gap-3 text-sm text-gray-500">
          <div className="neo-icon-wrap w-8 h-8 flex-shrink-0">
            <svg className="w-4 h-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-medium text-gray-700">{WORKSHEET.filename}</span>
          <span className="text-gray-300">·</span>
          <span>{t('archiveDetail.pages', { count: activePages.length })}</span>
          <span className="text-gray-300">·</span>
          <span>SOBP {WORKSHEET.sobp}</span>
        </section>

        {/* ── 요약 메트릭 ── */}
        <section className="mb-10 border-y border-app-border py-8">
          <div className="flex flex-wrap gap-6 sm:gap-12 text-gray-600 tracking-tight">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">{t('archiveDetail.classTime')}</span>
              <span className="text-lg font-semibold">{t('archiveDetail.minutes', { count: 42 })}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">{t('archiveDetail.participants')}</span>
              <span className="text-lg font-semibold">{t('archiveDetail.personCount', { count: activeStudents.length })}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">{t('archiveDetail.totalWriting')}</span>
              <span className="text-lg font-semibold">{t('archiveDetail.writingRatio', { written: allPageWriters, total: activeStudents.length })}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">{t('archiveDetail.annotations')}</span>
              <span className="text-lg font-semibold">{t('archiveDetail.annotationCount', { count: totalAnnotations })}</span>
            </div>
          </div>
        </section>

        {/* ── 탭 ── */}
        <section className="mb-8">
          <div className="flex gap-1.5 p-1 bg-brand-tint/30 rounded-2xl w-fit">
            {([
              { key: 'page' as const, label: t('archiveDetail.tabPageView') },
              { key: 'student' as const, label: t('archiveDetail.tabStudentView') },
              ...(!isSimple ? [{ key: 'ai' as const, label: t('archiveDetail.tabAiAnalysis') }] : []),
            ] as { key: ViewTab; label: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewTab(tab.key)}
                className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 active:scale-[0.97] ${
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
            {/* 필기 상태 도트맵 */}
            <div className="neo-card">
              <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{t('archiveDetail.writingStatus')}</h2>
                  <span className="text-[11px] text-gray-400 mt-0.5 block">{t('archiveDetail.writingStatusDesc')}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-primary inline-block" /> {t('archiveDetail.writing')}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {t('archiveDetail.poor')}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" /> {t('archiveDetail.noWriting')}</span>
                </div>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {[...activeStudents]
                  .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'))
                  .map(student => {
                    const summary = getStudentSummary(student.userId, activePages);
                    return (
                      <div key={student.userId} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-tint flex items-center justify-center text-brand-primary font-bold text-[11px] flex-shrink-0">
                          {student.nickname.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-14 flex-shrink-0">{student.nickname}</span>

                        {/* 도트 */}
                        <div className="flex items-center gap-1 flex-1">
                          {activePages.map(page => {
                            const s = page.students.find(st => st.userId === student.userId);
                            const strokeCount = s?.strokeCount ?? 0;
                            const classAvg = getPageClassAvg(page);
                            const status = getWritingStatus(strokeCount, classAvg);
                            const dot = getStatusDot(status);
                            return (
                              <div key={page.pageNum} className="relative group">
                                <div
                                  className={`w-4 h-4 rounded-full ${dot.color} cursor-default transition-transform group-hover:scale-125`}
                                />
                                {/* hover 툴팁 */}
                                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-800 text-white text-[10px] rounded-md whitespace-nowrap z-50 font-medium">
                                  P{page.pageNum} · {strokeCount === 0 ? t('archiveDetail.noWriting') : t('archiveDetail.strokes', { count: strokeCount })}
                                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 페이지 요약 */}
                        <span className="text-[11px] font-medium text-gray-500 flex-shrink-0 w-20 text-right">
                          {summary.writtenPages}/{summary.totalPages}P
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
            {/* ── 페이지 이동 네비게이션 ── */}
            <div className="flex items-center gap-2 py-2 overflow-x-auto">
              <span className="text-[11px] text-gray-400 font-medium mr-1 flex-shrink-0">{t('archiveDetail.shortcut')}</span>
              {activePages.map(p => (
                <button
                  key={p.pageNum}
                  onClick={() => {
                    const el = document.getElementById(`archive-page-${p.pageNum}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-app-border text-gray-600 hover:bg-brand-tint hover:text-brand-primary hover:border-brand-primary/30 transition-all flex-shrink-0"
                >
                  P{p.pageNum}
                  <span className="ml-1 text-[10px] font-normal text-gray-400">{p.students.filter(s => s.strokeCount > 0).length}/{p.students.length}</span>
                </button>
              ))}
            </div>

            {activePages.map(page => {
              const pageAnnotations = activeAnnotations.filter(e => e.pageNumber === page.pageNum);

              return (
                <div key={page.pageNum} id={`archive-page-${page.pageNum}`} className="scroll-mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded-md bg-gray-800 text-white text-xs font-bold flex items-center justify-center">P{page.pageNum}</span>
                    <span className="text-xs text-gray-500">
                      {t('archiveDetail.personWriting', { count: page.students.filter(s => s.strokeCount > 0).length })}
                    </span>
                    {pageAnnotations.length > 0 && (
                      <span className="text-[10px] text-brand-primary font-semibold flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        {t('archiveDetail.annotationCount', { count: pageAnnotations.length })} ({pageAnnotations.map(a => a.targetStudentName).join(', ')})
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[...page.students].sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko')).map((student) => {
                      const idx = page.students.findIndex(s => s.userId === student.userId);
                      return (
                        <div
                          key={student.userId}
                          className="flex flex-col bg-white rounded-xl overflow-hidden hover:shadow-sm hover:ring-2 hover:ring-brand-primary/20 transition-all cursor-pointer"
                          onClick={() => openWritingModal(idx, page.pageNum - 1)}
                        >
                          <div className="px-2.5 pt-2 pb-1">
                            <span className="text-[11px] font-semibold text-gray-700">{student.nickname}</span>
                          </div>
                          <div className="w-full bg-gray-100 mx-auto" style={{ aspectRatio: '210 / 297' }}>
                            {student.strokeCount > 0 ? (
                              <HandwritingThumbnail seed={idx} studentName={student.nickname} pageNum={page.pageNum} />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                                <svg className="w-6 h-6 text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                <span className="text-[10px] text-gray-300 font-medium">{t('archiveDetail.noWriting')}</span>
                              </div>
                            )}
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
            {/* 상단 요약: 첨삭 현황 */}
            <div className="neo-card overflow-hidden">
              <div className="px-5 py-4 border-b border-app-border">
                <h2 className="text-sm font-semibold text-gray-900">{t('archiveDetail.annotationStatus')}</h2>
                <span className="text-[11px] text-gray-400 mt-0.5 block">{t('archiveDetail.annotationStatusDesc')}</span>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2.5">
                {[...activeStudents]
                  .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'))
                  .map(student => {
                    const annotations = activeAnnotations.filter(e => e.targetStudentName === student.nickname);
                    const responded = annotations.filter(a => a.studentRewriteAfter > 0).length;
                    return (
                      <div key={student.userId} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-tint flex items-center justify-center text-brand-primary font-bold text-[11px] flex-shrink-0">
                          {student.nickname.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-14 flex-shrink-0">{student.nickname}</span>
                        {annotations.length > 0 ? (
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs text-brand-primary font-semibold">{t('archiveDetail.annotationCount', { count: annotations.length })}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-500">
                              {annotations.map(a => `P${a.pageNumber}`).join(', ')}
                            </span>
                            <span className="text-gray-300">·</span>
                            {responded > 0 ? (
                              <span className="text-[11px] text-emerald-600 font-medium">{t('archiveDetail.responseCount', { count: responded })}</span>
                            ) : (
                              <span className="text-[11px] text-gray-400">{t('archiveDetail.noResponse')}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 flex-1">{t('archiveDetail.noAnnotation')}</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* 학생 바로가기 */}
            <div className="flex items-center gap-2 py-2 overflow-x-auto">
              <span className="text-[11px] text-gray-400 font-medium mr-1 flex-shrink-0">{t('archiveDetail.shortcut')}</span>
              {[...activeStudents]
                .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'))
                .map(student => (
                    <button
                      key={student.userId}
                      onClick={() => {
                        const el = document.getElementById(`student-card-${student.userId}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-app-border text-gray-600 hover:bg-brand-tint hover:text-brand-primary hover:border-brand-primary/30 transition-all flex-shrink-0"
                    >
                      {student.nickname}
                    </button>
                  ))}
            </div>

            {/* 학생별 상세 카드 (이름 가나다순) */}
            {[...activeStudents]
              .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'))
              .map(student => {
              const idx = activeStudents.findIndex(s => s.userId === student.userId);
              const feedbackEvents = activeAnnotations.filter(e => e.targetStudentName === student.nickname);
              return (
                <div key={student.userId} id={`student-card-${student.userId}`} className="neo-card overflow-hidden scroll-mt-4">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-tint flex items-center justify-center text-brand-primary font-bold text-sm">
                        {student.nickname.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{student.nickname}</div>
                        {feedbackEvents.length > 0 && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-semibold text-brand-primary">{t('archiveDetail.annotationCount', { count: feedbackEvents.length })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 첨삭 내용 (있을 경우) */}
                  {feedbackEvents.length > 0 && (
                    <div className="px-5 py-3 bg-brand-tint/10 border-b border-app-border">
                      <div className="flex items-center gap-1.5 mb-2">
                        <svg className="w-3.5 h-3.5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span className="text-[11px] font-semibold text-brand-primary">{t('archiveDetail.teacher')} {t('archiveDetail.annotations')}</span>
                      </div>
                      {feedbackEvents.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600 mb-1.5 last:mb-0">
                          <span className="font-mono text-gray-400 flex-shrink-0 text-[10px] bg-gray-100 px-1 py-0.5 rounded">P{e.pageNumber}</span>
                          <span className="text-gray-300">→</span>
                          {e.studentRewriteAfter > 0 ? (
                            <span className="text-emerald-600 font-medium">이후 추가 필기 있음</span>
                          ) : (
                            <span className="text-gray-400">이후 추가 필기 없음</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Page thumbnails (≤5P) or dot list (6P+) */}
                  {activePages.length <= 5 ? (
                    <div className={`grid divide-x divide-app-border ${
                      activePages.length <= 3 ? 'grid-cols-3' : 'grid-cols-5'
                    }`}>
                      {activePages.map((page, pi) => {
                        const s = page.students.find(st => st.userId === student.userId);
                        const strokeCount = s?.strokeCount ?? 0;
                        const hasFeedback = feedbackEvents.some(e => e.pageNumber === page.pageNum);
                        return (
                          <div
                            key={page.pageNum}
                            className="p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => openWritingModal(idx, pi)}
                          >
                            <div className="flex items-center justify-between w-full px-0.5">
                              <div className="flex items-center gap-1">
                                <span className="w-6 h-6 rounded-md bg-gray-800 text-white text-[10px] font-bold flex items-center justify-center">P{page.pageNum}</span>
                                {hasFeedback && (
                                  <svg className="w-3 h-3 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-[10px] font-medium ${strokeCount === 0 ? 'text-gray-300' : 'text-gray-500'}`}>{strokeCount === 0 ? t('archiveDetail.noWriting') : t('archiveDetail.strokes', { count: strokeCount })}</span>
                            </div>
                            <div className="w-full bg-gray-50 border border-gray-100 rounded overflow-hidden" style={{ aspectRatio: '210 / 297' }}>
                              {strokeCount > 0 ? (
                                <HandwritingThumbnail seed={idx} studentName={student.nickname} pageNum={page.pageNum} />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                  <svg className="w-5 h-5 text-gray-200 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  <span className="text-[9px] text-gray-300">{t('archiveDetail.noWriting')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* 6P 이상: 도트 리스트 — 클릭 시 리플레이 모달 */
                    <div className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {activePages.map((page, pi) => {
                          const s = page.students.find(st => st.userId === student.userId);
                          const strokeCount = s?.strokeCount ?? 0;
                          const classAvg = getPageClassAvg(page);
                          const status = getWritingStatus(strokeCount, classAvg);
                          const dot = getStatusDot(status);
                          const hasFeedback = feedbackEvents.some(e => e.pageNumber === page.pageNum);
                          return (
                            <button
                              key={page.pageNum}
                              onClick={() => openWritingModal(idx, pi)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-app-border hover:border-brand-primary/30 hover:bg-brand-tint/10 transition-all group"
                            >
                              <div className={`w-3 h-3 rounded-full ${dot.color} group-hover:scale-110 transition-transform`} />
                              <span className="text-[11px] font-semibold text-gray-600">P{page.pageNum}</span>
                              {hasFeedback && (
                                <svg className="w-2.5 h-2.5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              )}
                              <span className="text-[10px] text-gray-400">{strokeCount === 0 ? t('archiveDetail.noWriting') : t('archiveDetail.strokes', { count: strokeCount })}</span>
                            </button>
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

        {/* ── AI 분석 ── */}
        {viewTab === 'ai' && (
          <section className="flex flex-col gap-8 mb-16">

            {/* ── 1. 분석 시작 히어로 ── */}
            {!sessionAnalysis && !sessionAnalyzing && (
              <div className="neo-card overflow-hidden bg-gradient-to-br from-brand-tint/40 via-white to-brand-tint/20">
                <div className="px-6 sm:px-10 py-12 flex flex-col items-center text-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">{t('archiveDetail.participationReport')}</h2>
                    <p className="text-sm text-gray-500 max-w-md">{t('archiveDetail.classSummaryDesc')}</p>
                  </div>
                  <button
                    onClick={startSessionAnalysis}
                    className="px-8 py-3 bg-brand-primary text-white text-sm font-bold rounded-full hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 transition-all hover:shadow-xl hover:shadow-brand-primary/30 hover:-translate-y-0.5"
                  >
                    {t('archiveDetail.startAnalysis')}
                  </button>
                </div>
              </div>
            )}

            {sessionAnalyzing && (
              <div className="neo-card overflow-hidden">
                <div className="px-6 sm:px-10 py-16 flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 border-3 border-brand-tint rounded-full" />
                    <div className="absolute inset-0 w-12 h-12 border-3 border-transparent border-t-brand-primary rounded-full animate-spin" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-gray-700 block">{t('archiveDetail.analyzing')}</span>
                    <span className="text-xs text-gray-400 mt-1 block">{t('archiveDetail.analyzing')}</span>
                  </div>
                </div>
              </div>
            )}

            {sessionAnalysis && (
              <>
                {/* ── 수업 참여 리포트 ── */}
                <div className="neo-card overflow-hidden">
                  <div className="px-5 sm:px-8 py-5 border-b border-app-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-gray-900">{t('archiveDetail.participationReport')}</h2>
                        <span className="text-[11px] text-gray-400">필기 데이터 기반 자동 생성</span>
                      </div>
                    </div>
                    <button
                      onClick={resetSessionAnalysis}
                      className="px-3 py-1.5 text-[11px] font-medium text-gray-400 hover:text-brand-primary border border-gray-200 rounded-lg hover:border-brand-primary/30 transition-all"
                    >
                      {t('archiveDetail.resetAnalysis')}
                    </button>
                  </div>

                  <div className="px-5 sm:px-8 py-6 flex flex-col gap-5">
                    {/* 참여 현황 */}
                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t('archiveDetail.participationSummary')}</h3>
                      <p className="text-sm text-gray-700 leading-relaxed">{sessionAnalysis.participationSummary}</p>
                    </div>

                    {/* 페이지별 이탈 패턴 */}
                    <div className="flex items-start gap-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100/50">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      </span>
                      <div>
                        <h3 className="text-xs font-bold text-amber-700 mb-1">{t('archiveDetail.pageDropoff')}</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">{sessionAnalysis.pageDropoff}</p>
                      </div>
                    </div>

                    {/* 첨삭 현황 */}
                    <div className="flex items-start gap-3 p-4 bg-brand-tint/20 rounded-xl border border-brand-primary/5">
                      <span className="text-brand-primary mt-0.5 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </span>
                      <div>
                        <h3 className="text-xs font-bold text-brand-primary mb-1">{t('archiveDetail.annotationStatus')}</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">{sessionAnalysis.annotationSummary}</p>
                      </div>
                    </div>

                    {/* ── 수업 음성 분석 (STT) ── */}
                    <div className="p-5 bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200 flex flex-col gap-5">
                      {/* 헤더 */}
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <h3 className="text-sm font-bold text-gray-800">{t('archiveDetail.voiceAnalysisTitle')}</h3>
                        <span className="text-[10px] text-gray-400 font-normal">(STT)</span>
                      </div>

                      {/* 수업 요약 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t('archiveDetail.classSummary')}</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">{sessionAnalysis.voiceAnalysis.classSummary}</p>
                      </div>

                      {/* 학생 질문 목록 */}
                      {sessionAnalysis.voiceAnalysis.studentQuestions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('archiveDetail.studentQuestions')}</h4>
                          <div className="flex flex-col gap-1.5">
                            {sessionAnalysis.voiceAnalysis.studentQuestions.map((q, i) => (
                              <div key={i} className="flex items-start gap-3 px-3 py-2 bg-white rounded-lg border border-gray-100">
                                <span className="text-[11px] text-gray-400 font-mono flex-shrink-0 pt-0.5">{q.timestamp}</span>
                                <span className="text-[11px] font-semibold text-indigo-600 flex-shrink-0 pt-0.5">{q.studentName}</span>
                                <span className="text-xs text-gray-600 leading-relaxed">&ldquo;{q.question}&rdquo;</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 주요 이슈 */}
                      {sessionAnalysis.voiceAnalysis.keyIssues.length > 0 && (
                        <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/50">
                          <h4 className="text-xs font-bold text-amber-700 mb-2">{t('archiveDetail.keyIssues')}</h4>
                          <ul className="flex flex-col gap-1">
                            {sessionAnalysis.voiceAnalysis.keyIssues.map((issue, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                                <span className="text-amber-500 flex-shrink-0 mt-0.5">&#x2022;</span>
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 발화 통계 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('archiveDetail.speakingStats')}</h4>
                        {/* 비율 바 */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[11px] text-gray-500">{t('archiveDetail.teacher')}</span>
                          <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-indigo-400 rounded-l-full"
                              style={{ width: `${sessionAnalysis.voiceAnalysis.speakingStats.teacherRatio}%` }}
                            />
                            <div
                              className="h-full bg-emerald-400 rounded-r-full"
                              style={{ width: `${sessionAnalysis.voiceAnalysis.speakingStats.studentRatio}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-gray-500">{t('archiveDetail.students')}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-400" />
                            {t('archiveDetail.teacher')} {sessionAnalysis.voiceAnalysis.speakingStats.teacherRatio}%
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            {t('archiveDetail.students')} {sessionAnalysis.voiceAnalysis.speakingStats.studentRatio}%
                          </span>
                        </div>
                        {/* 학생별 발화 횟수 */}
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {sessionAnalysis.voiceAnalysis.speakingStats.perStudent.map((s) => (
                            <span
                              key={s.studentId}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                s.count > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {s.studentName} {s.count}{t('archiveDetail.speakCount')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 학생별 필기 패턴 분석 ── */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-900">{t('archiveDetail.studentAnalysis')}</h3>
                    <span className="text-[11px] text-gray-400">펼쳐서 상세 패턴을 확인하세요</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[...activeStudents].sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko')).map(student => {
                      const isExpanded = expandedStudents.has(student.userId);
                      const analysis = studentAnalyses[student.userId];
                      const isAnalyzing = studentAnalyzing.has(student.userId);
                      const feedbackCount = activeAnnotations.filter(e => e.targetStudentName === student.nickname).length;
                      const initial = student.nickname.charAt(0);

                      return (
                        <div key={student.userId} className="neo-card overflow-hidden">
                          <button
                            onClick={() => {
                              toggleStudentExpand(student.userId);
                              if (!analysis && !isAnalyzing && !expandedStudents.has(student.userId)) {
                                startStudentAnalysis(student.userId);
                              }
                            }}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-brand-tint flex items-center justify-center text-brand-primary font-bold text-sm">
                                {initial}
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-gray-800">{student.nickname}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {feedbackCount > 0 && (
                                    <span className="text-[10px] font-semibold text-brand-primary">{t('archiveDetail.annotationCount', { count: feedbackCount })}</span>
                                  )}
                                  {analysis && (
                                    <span className="text-[10px] font-medium text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">{t('archiveDetail.analysisComplete')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <svg
                              className={`w-5 h-5 text-gray-300 group-hover:text-brand-primary transition-all ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>

                          {isExpanded && (
                            <div className="px-6 pb-6 flex flex-col gap-4 border-t border-app-border pt-4">

                              {isAnalyzing && (
                                <div className="flex items-center gap-3 py-4 justify-center">
                                  <div className="w-5 h-5 border-2 border-gray-200 border-t-brand-primary rounded-full animate-spin" />
                                  <span className="text-xs text-gray-400">{t('archiveDetail.patternAnalyzing')}</span>
                                </div>
                              )}

                              {analysis && (
                                <div className="flex flex-col gap-3">
                                  {/* 필기 패턴 */}
                                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                      <h4 className="text-xs font-bold text-gray-500">{t('archiveDetail.writingPattern')}</h4>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed">{analysis.pattern}</p>
                                  </div>

                                  {/* 첨삭 반응 */}
                                  <div className="p-4 bg-brand-tint/10 rounded-xl border border-brand-primary/5">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <svg className="w-3.5 h-3.5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                      <h4 className="text-xs font-bold text-brand-primary">{t('archiveDetail.annotationReaction')}</h4>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed">{analysis.annotationResponse}</p>
                                  </div>

                                  {/* 주의 포인트 */}
                                  {analysis.attention !== '전체적으로 안정적 참여. 별도 주의 사항 없음.' && (
                                    <div className="flex items-start gap-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100/50">
                                      <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                      <div>
                                        <h4 className="text-xs font-bold text-amber-600 mb-1">{t('archiveDetail.attentionPoint')}</h4>
                                        <p className="text-xs text-gray-600 leading-relaxed">{analysis.attention}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {!analysis && !isAnalyzing && (
                                <button
                                  onClick={() => startStudentAnalysis(student.userId)}
                                  className="w-fit px-5 py-2 bg-brand-tint/30 text-gray-600 text-xs font-semibold rounded-lg hover:bg-brand-tint hover:text-brand-primary transition-colors"
                                >
                                  패턴 분석 생성
                                </button>
                              )}

                              {/* 페이지별 필기 상태 */}
                              <div>
                                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">페이지별 필기</h4>
                                <div className="flex items-center gap-2">
                                  {activePages.map(page => {
                                    const s = page.students.find(st => st.userId === student.userId);
                                    const strokeCount = s?.strokeCount ?? 0;
                                    const classAvg = getPageClassAvg(page);
                                    const status = getWritingStatus(strokeCount, classAvg);
                                    const dot = getStatusDot(status);
                                    return (
                                      <div key={page.pageNum} className="flex items-center gap-1.5 text-xs">
                                        <div className={`w-3.5 h-3.5 rounded-full ${dot.color}`} />
                                        <span className="text-gray-400 font-medium">P{page.pageNum}</span>
                                        <span className="text-gray-300">{strokeCount === 0 ? '—' : t('archiveDetail.strokes', { count: strokeCount })}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

          </section>
        )}

      </main>

      {/* ── 필기 리플레이 모달 ── */}
      {writingModal.open && (() => {
        const { studentIdx, pageIdx } = writingModal;
        const page = activePages[pageIdx];
        const student = page?.students[studentIdx];
        const rate = student ? getRate(student.strokeCount, student.maxStroke) : 0;
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) closeWritingModal(); }}
          >
            <div className="bg-white rounded-2xl w-[90vw] max-w-[480px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Header — Figma: "필기 재생" + ✕ */}
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">필기 재생</h2>
                  <span className="text-[11px] text-gray-400">{student?.nickname ?? ''} · P{pageIdx + 1}</span>
                </div>
                <button
                  onClick={closeWritingModal}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="닫기 (ESC)"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>
                </button>
              </div>

              {/* Canvas — A4 비율 */}
              <div className="flex-1 overflow-y-auto flex items-center justify-center px-5 pb-2">
                <div className="w-full bg-brand-tint/20 border border-gray-200 rounded-xl overflow-hidden" style={{ aspectRatio: '210 / 297' }}>
                  {student && student.strokeCount > 0 ? (
                    <HandwritingThumbnail seed={studentIdx} studentName={student.nickname} pageNum={pageIdx + 1} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                      <svg className="w-8 h-8 text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-400">{t('archiveDetail.noWriting')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Seekbar — 블루 도트 + 시간 */}
              <div className="px-5 pt-3">
                <div
                  className="relative w-full h-5 flex items-center cursor-pointer group"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = ((e.clientX - rect.left) / rect.width) * 100;
                    seekReplay(percent);
                  }}
                >
                  {/* 트랙 */}
                  <div className="absolute left-0 right-0 h-[3px] bg-gray-200 rounded-full">
                    <div className="h-full bg-brand-primary rounded-full transition-all" style={{ width: `${replayState.progress}%` }} />
                  </div>
                  {/* 블루 도트 */}
                  <div
                    className="absolute w-3.5 h-3.5 bg-brand-primary rounded-full shadow-sm -translate-x-1/2 transition-all group-hover:scale-125"
                    style={{ left: `${replayState.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 font-mono mt-0.5">
                  <span>{formatTime((replayState.progress / 100) * REPLAY_DURATION_SEC)}</span>
                  <span>{formatTime(REPLAY_DURATION_SEC)}</span>
                </div>
              </div>

              {/* Controls — 1x / ⏪10 / ▶ / ⏩10 */}
              <div className="flex items-center justify-center gap-5 px-5 py-4">
                {/* 속도 */}
                <button
                  onClick={cycleSpeed}
                  className="text-sm font-bold text-gray-500 hover:text-brand-primary transition-colors w-8 text-center"
                  title="재생 속도"
                >
                  {replaySpeed}x
                </button>

                {/* ⏪ 10초 */}
                <button
                  onClick={() => skipReplay(-10)}
                  disabled={rate === 0}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="10초 뒤로"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.5 8L8 12l4.5 4" />
                    <path d="M16 8l-4.5 4L16 16" />
                  </svg>
                  <span className="absolute text-[7px] font-bold text-gray-400 mt-4">10</span>
                </button>

                {/* ▶ / ⏸ */}
                <button
                  onClick={toggleReplay}
                  disabled={rate === 0}
                  className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                  title={replayState.playing ? '일시정지' : '재생'}
                >
                  {replayState.playing ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><rect x="5" y="4" width="3.5" height="12" rx="1"/><rect x="11.5" y="4" width="3.5" height="12" rx="1"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4l10 6-10 6V4z"/></svg>
                  )}
                </button>

                {/* ⏩ 10초 */}
                <button
                  onClick={() => skipReplay(10)}
                  disabled={rate === 0}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="10초 앞으로"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 8L16 12l-4.5 4" />
                    <path d="M8 8l4.5 4L8 16" />
                  </svg>
                  <span className="absolute text-[7px] font-bold text-gray-400 mt-4">10</span>
                </button>

                {/* 페이지 이동 (prev/next) */}
                <div className="flex items-center gap-1 ml-2 border-l border-gray-200 pl-4">
                  <button
                    onClick={() => modalNavPage(-1)}
                    disabled={pageIdx === 0}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    title="이전 페이지"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 16l-6-6 6-6"/></svg>
                  </button>
                  <span className="text-[11px] font-bold text-gray-500 w-8 text-center">P{pageIdx + 1}</span>
                  <button
                    onClick={() => modalNavPage(1)}
                    disabled={pageIdx === activePages.length - 1}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    title="다음 페이지"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 4l6 6-6 6"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
