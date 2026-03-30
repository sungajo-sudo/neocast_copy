// src/data/voiceScenario.ts
// v1: 필기 패턴 + 첨삭 반응 기반 분석 프롬프트

export type Locale = 'ko' | 'ja' | 'zh-TW' | 'en';

/* ─── 원본 데이터 인터페이스 ─── */

/** 펜 이벤트 기반 첨삭 기록 (음성 X, 펜 O) */
export interface AnnotationEvent {
  timestamp: string;
  pageNumber: number;
  hostId: string;
  targetStudentId: string;
  targetStudentName: string;
  strokeCount: number;            // 첨삭 시 호스트가 쓴 획수
  studentRewriteAfter: number;    // 첨삭 후 학생 추가 획수 (0이면 반응 없음)
}

/** 페이지별 학생 필기 데이터 */
export interface PageStrokeData {
  pageNumber: number;
  students: {
    studentId: string;
    studentName: string;
    strokeCount: number;
  }[];
  classAverage: number;           // 필기한 학생들의 평균 획수
}

/** 세션 메타 */
export interface SessionMeta {
  name: string;
  duration: number;
  studentCount: number;
  pageCount: number;
  locale: Locale;
}

/** 학생 정보 (분석용) */
export interface StudentStrokeProfile {
  studentId: string;
  studentName: string;
  pages: {
    pageNumber: number;
    strokeCount: number;
    classAverage: number;
    status: 'wrote' | 'low' | 'none';  // 필기 / 부진 / 미필기
  }[];
  writtenPages: number;
  totalPages: number;
  annotations: {
    pageNumber: number;
    rewriteAfter: number;  // 첨삭 후 추가 획수
  }[];
}

/* ─── 더미 첨삭 이벤트 (펜 기반) ─── */
// 학생: guest_001 박민준, guest_002 이서연, guest_003 최도윤, guest_004 정하은, guest_005 강지우

export const ANNOTATION_EVENTS: AnnotationEvent[] = [
  { timestamp: '14:12', pageNumber: 1, hostId: 'host_001', targetStudentId: 'guest_001', targetStudentName: '박민준', strokeCount: 5, studentRewriteAfter: 20 },
  { timestamp: '14:22', pageNumber: 2, hostId: 'host_001', targetStudentId: 'guest_002', targetStudentName: '이서연', strokeCount: 3, studentRewriteAfter: 8 },
  { timestamp: '14:33', pageNumber: 3, hostId: 'host_001', targetStudentId: 'guest_003', targetStudentName: '최도윤', strokeCount: 4, studentRewriteAfter: 0 },
  { timestamp: '14:42', pageNumber: 1, hostId: 'host_001', targetStudentId: 'guest_005', targetStudentName: '강지우', strokeCount: 8, studentRewriteAfter: 0 },
  { timestamp: '14:45', pageNumber: 3, hostId: 'host_001', targetStudentId: 'guest_001', targetStudentName: '박민준', strokeCount: 4, studentRewriteAfter: 15 },
];

/** 학생 질문 (STT에서 추출) */
export interface StudentQuestion {
  timestamp: string;
  studentId: string;
  studentName: string;
  question: string;
}

/** 음성 분석 결과 (STT 기반) */
export interface VoiceAnalysis {
  classSummary: string;
  studentQuestions: StudentQuestion[];
  keyIssues: string[];
  speakingStats: {
    teacherRatio: number;
    studentRatio: number;
    perStudent: {
      studentId: string;
      studentName: string;
      count: number;
    }[];
  };
}

/** 더미 STT 요약 (원본 전사가 아닌 요약 텍스트) — 하위호환용 유지 */
export const DUMMY_STT_SUMMARY: Record<Locale, string> = {
  ko: '수업 중 음성 대화가 기록되었습니다. 이차방정식의 세 가지 풀이법(인수분해, 완전제곱식, 근의 공식)을 다룬 것으로 보이며, 판별식 관련 질문이 반복적으로 발생했습니다.',
  ja: '授業中の音声会話が記録されました。二次方程式の3つの解法（因数分解、完全平方式、解の公式）を扱い、判別式に関する質問が繰り返し発生しました。',
  'zh-TW': '課堂中的語音對話已記錄。涉及二次方程的三種解法（因式分解、完全平方式、求根公式），判別式相關問題反覆出現。',
  en: 'Voice conversations were recorded during the session. The class covered three methods for solving quadratic equations (factoring, completing the square, quadratic formula), with repeated questions about the discriminant.',
};

/** 더미 음성 분석 결과 (locale별) */
export const DUMMY_VOICE_ANALYSIS: Record<Locale, VoiceAnalysis> = {
  ko: {
    classSummary: '이차방정식의 세 가지 풀이법(인수분해, 완전제곱식, 근의 공식)을 순서대로 설명했습니다. P2 판별식 활용 문제에서 학생 질문이 집중되었으며, P3 종합 서술형 풀이에서는 풀이 순서 혼란이 관찰되었습니다.',
    studentQuestions: [
      { timestamp: '14:08', studentId: 'guest_002', studentName: '이서연', question: '판별식이 0이면 해가 하나인 건가요, 중근인 건가요?' },
      { timestamp: '14:15', studentId: 'guest_003', studentName: '최도윤', question: '완전제곱식으로 바꾸는 게 왜 필요해요?' },
      { timestamp: '14:22', studentId: 'guest_002', studentName: '이서연', question: '판별식이 음수면 해가 없는 거 맞죠?' },
      { timestamp: '14:32', studentId: 'guest_001', studentName: '박민준', question: '근의 공식에서 ±는 왜 두 개가 나와요?' },
      { timestamp: '14:41', studentId: 'guest_003', studentName: '최도윤', question: '서술형 풀이 순서가 인수분해 먼저인가요?' },
    ],
    keyIssues: [
      '판별식 개념 혼동 — 이서연, 최도윤 등 3명이 유사 질문 반복',
      'P3 종합 서술형에서 풀이 순서(인수분해 vs 근의 공식) 선택 기준에 대한 혼란 발생',
      '강지우는 수업 중 발화가 없었으며 P1, P3 미필기와 연관 가능성',
    ],
    speakingStats: {
      teacherRatio: 72,
      studentRatio: 28,
      perStudent: [
        { studentId: 'guest_002', studentName: '이서연', count: 3 },
        { studentId: 'guest_003', studentName: '최도윤', count: 2 },
        { studentId: 'guest_001', studentName: '박민준', count: 2 },
        { studentId: 'guest_004', studentName: '정하은', count: 1 },
        { studentId: 'guest_005', studentName: '강지우', count: 0 },
      ],
    },
  },
  ja: {
    classSummary: '二次方程式の3つの解法（因数分解、完全平方式、解の公式）を順に説明しました。P2の判別式活用問題で生徒の質問が集中し、P3の総合記述問題では解法の手順に混乱が見られました。',
    studentQuestions: [
      { timestamp: '14:08', studentId: 'guest_002', studentName: '鈴木 美咲', question: '判別式が0のとき、解は1つですか？それとも重根ですか？' },
      { timestamp: '14:15', studentId: 'guest_003', studentName: '高橋 蓮', question: '完全平方式に変形する必要があるのはなぜですか？' },
      { timestamp: '14:22', studentId: 'guest_002', studentName: '鈴木 美咲', question: '判別式が負の場合、解なしで合ってますか？' },
      { timestamp: '14:32', studentId: 'guest_001', studentName: '田中 悠真', question: '解の公式で±が出るのはなぜ2つになるんですか？' },
      { timestamp: '14:41', studentId: 'guest_003', studentName: '高橋 蓮', question: '記述式の解法の順番は因数分解が先ですか？' },
    ],
    keyIssues: [
      '判別式の概念混乱 — 鈴木、高橋など3名が類似の質問を繰り返し',
      'P3の総合記述問題で解法の順序（因数分解 vs 解の公式）の選択基準に混乱',
      '佐藤 陽菜は授業中発言がなく、P1・P3の未筆記と関連の可能性',
    ],
    speakingStats: {
      teacherRatio: 72,
      studentRatio: 28,
      perStudent: [
        { studentId: 'guest_002', studentName: '鈴木 美咲', count: 3 },
        { studentId: 'guest_003', studentName: '高橋 蓮', count: 2 },
        { studentId: 'guest_001', studentName: '田中 悠真', count: 2 },
        { studentId: 'guest_004', studentName: '伊藤 結衣', count: 1 },
        { studentId: 'guest_005', studentName: '佐藤 陽菜', count: 0 },
      ],
    },
  },
  'zh-TW': {
    classSummary: '依序講解了一元二次方程式的三種解法（因式分解、配方法、公式解）。P2判別式應用題集中了學生提問，P3綜合論述題出現了解題順序的混亂。',
    studentQuestions: [
      { timestamp: '14:08', studentId: 'guest_002', studentName: '林美玲', question: '判別式等於0的時候，是只有一個解還是重根？' },
      { timestamp: '14:15', studentId: 'guest_003', studentName: '陳志偉', question: '為什麼需要用配方法轉換？' },
      { timestamp: '14:22', studentId: 'guest_002', studentName: '林美玲', question: '判別式是負數就代表無解對吧？' },
      { timestamp: '14:32', studentId: 'guest_001', studentName: '王大明', question: '公式解裡的±為什麼會產生兩個解？' },
      { timestamp: '14:41', studentId: 'guest_003', studentName: '陳志偉', question: '論述題的解題順序是先因式分解嗎？' },
    ],
    keyIssues: [
      '判別式概念混淆 — 林美玲、陳志偉等3人重複類似提問',
      'P3綜合論述題中，解題順序（因式分解 vs 公式解）的選擇標準出現混亂',
      '張小華課堂中沒有發言，且P1、P3未書寫，可能存在關聯',
    ],
    speakingStats: {
      teacherRatio: 72,
      studentRatio: 28,
      perStudent: [
        { studentId: 'guest_002', studentName: '林美玲', count: 3 },
        { studentId: 'guest_003', studentName: '陳志偉', count: 2 },
        { studentId: 'guest_001', studentName: '王大明', count: 2 },
        { studentId: 'guest_004', studentName: '李怡君', count: 1 },
        { studentId: 'guest_005', studentName: '張小華', count: 0 },
      ],
    },
  },
  en: {
    classSummary: 'Three methods for solving quadratic equations (factoring, completing the square, quadratic formula) were explained in order. Student questions concentrated during P2 discriminant problems, and confusion about solution order was observed in P3 comprehensive written problems.',
    studentQuestions: [
      { timestamp: '14:08', studentId: 'guest_002', studentName: 'Emily S.', question: 'When the discriminant is 0, is there one solution or a repeated root?' },
      { timestamp: '14:15', studentId: 'guest_003', studentName: 'James T.', question: 'Why do we need to complete the square?' },
      { timestamp: '14:22', studentId: 'guest_002', studentName: 'Emily S.', question: 'If the discriminant is negative, does that mean no solution?' },
      { timestamp: '14:32', studentId: 'guest_001', studentName: 'Alex K.', question: 'Why does the ± in the quadratic formula give two answers?' },
      { timestamp: '14:41', studentId: 'guest_003', studentName: 'James T.', question: 'Should we try factoring first for written problems?' },
    ],
    keyIssues: [
      'Discriminant concept confusion — Emily, James and 1 other repeated similar questions',
      'P3 comprehensive problem: confusion about choosing between factoring vs quadratic formula',
      'Sarah H. had no verbal participation and did not write on P1 or P3',
    ],
    speakingStats: {
      teacherRatio: 72,
      studentRatio: 28,
      perStudent: [
        { studentId: 'guest_002', studentName: 'Emily S.', count: 3 },
        { studentId: 'guest_003', studentName: 'James T.', count: 2 },
        { studentId: 'guest_001', studentName: 'Alex K.', count: 2 },
        { studentId: 'guest_004', studentName: 'Mia L.', count: 1 },
        { studentId: 'guest_005', studentName: 'Sarah H.', count: 0 },
      ],
    },
  },
};

/* ─── 톤/문화 가이드 ─── */

const TONE_GUIDE: Record<Locale, string> = {
  ko: '교사가 이해할 수 있는 간결하고 객관적인 톤으로 한국어로 작성하세요.',
  ja: '教師が理解しやすい簡潔で客観的な日本語で作成してください。',
  'zh-TW': '請以教師易於理解的簡潔客觀語氣，用繁體中文撰寫。',
  en: 'Write in concise, objective English suitable for teachers.',
};

const CULTURE_GUIDE: Record<Locale, string> = {
  ko: '',
  ja: '生徒が発言しないことを否定的に評価しないでください。',
  'zh-TW': '不要將學生未發言視為消極表現。',
  en: 'Do not interpret silence as lack of engagement.',
};

/* ─── v1 세션 분석 프롬프트 ─── */

export function buildSessionPromptV1(
  meta: SessionMeta,
  pages: PageStrokeData[],
  annotations: AnnotationEvent[],
  sttSummary: string | null,
): string {
  const locale = meta.locale;

  // 페이지별 통계 문자열 조립
  const pageStats = pages.map(p => {
    const writers = p.students.filter(s => s.strokeCount > 0);
    const nonWriters = p.students.filter(s => s.strokeCount === 0);
    return `P${p.pageNumber}: ${writers.length}/${p.students.length}명 필기, 평균 ${Math.round(p.classAverage)}획, 미필기 ${nonWriters.length}명${nonWriters.length > 0 ? ` (${nonWriters.map(s => s.studentName).join(', ')})` : ''}`;
  }).join('\n');

  // 첨삭 통계
  const annotationStats = annotations.length > 0
    ? annotations.map(a =>
        `${a.timestamp} P${a.pageNumber} → ${a.targetStudentName}: 첨삭 ${a.strokeCount}획, 이후 학생 추가 필기 ${a.studentRewriteAfter}획`
      ).join('\n')
    : '첨삭 기록 없음';

  return `You are a class participation pattern analyzer.
Analyze ONLY based on the writing (stroke) data and annotation data provided below.
Do NOT infer what students wrote or whether answers are correct — you only know stroke counts.
${TONE_GUIDE[locale]}
${CULTURE_GUIDE[locale]}

[Session Info]
- Class: ${meta.name}
- Duration: ${meta.duration} min
- Students: ${meta.studentCount}
- Pages: ${meta.pageCount}

[Page-by-Page Stroke Data]
${pageStats}

[Annotation Events (host → student pen feedback)]
${annotationStats}

${sttSummary ? `[Voice Summary (reference only, do not over-rely)]\n${sttSummary}` : ''}

IMPORTANT constraints:
- You can only see stroke COUNTS, not what was written.
- "High stroke count" does NOT mean "correct answer". It means "more writing activity".
- "Low stroke count" means less activity — could be stuck, confused, or simply efficient.
- Focus on: participation patterns, page-by-page dropoff, annotation response behavior.
- Do NOT make claims about concept understanding, answer correctness, or learning quality.

Return JSON only:
{
  "participationSummary": "2-3 sentences: overall participation pattern across students",
  "pageDropoff": "2-3 sentences: how writing activity changed across pages, who dropped off where",
  "annotationSummary": "2-3 sentences: how many annotations, who received them, did students respond with additional writing?",
  "voiceSummary": "1-2 sentences: brief note on voice activity (if provided, otherwise say 'no voice data')"
}
Return valid JSON only, no other text.`;
}

/* ─── v1 학생 개인 분석 프롬프트 ─── */

export function buildStudentPromptV1(
  student: StudentStrokeProfile,
  annotations: AnnotationEvent[],
  locale: Locale,
): string {
  // 페이지별 상태 문자열
  const pageDetail = student.pages.map(p =>
    `P${p.pageNumber}: ${p.strokeCount}획 (학급평균 ${Math.round(p.classAverage)}획) → ${
      p.status === 'none' ? '미필기' :
      p.status === 'low' ? '부진 (평균 40% 미만)' :
      '필기'
    }`
  ).join('\n');

  // 이 학생의 첨삭
  const studentAnnotations = annotations.filter(a => a.targetStudentId === student.studentId);
  const annotationDetail = studentAnnotations.length > 0
    ? studentAnnotations.map(a =>
        `P${a.pageNumber} (${a.timestamp}): 첨삭 ${a.strokeCount}획 받음 → 이후 추가 필기 ${a.studentRewriteAfter}획${a.studentRewriteAfter > 0 ? ' (반응함)' : ' (반응 없음)'}`
      ).join('\n')
    : '첨삭 기록 없음';

  return `You are a student writing pattern analyzer.
Analyze ONLY this student's pen stroke data. You cannot see what they wrote — only how much.
${TONE_GUIDE[locale]}
${CULTURE_GUIDE[locale]}

[Student]
- Name: ${student.studentName}
- Pages with writing: ${student.writtenPages}/${student.totalPages}

[Page-by-Page Data]
${pageDetail}

[Annotations Received]
${annotationDetail}

IMPORTANT constraints:
- You know stroke COUNTS only, not content.
- Do NOT say "the student understands X concept" — you cannot know this.
- Do NOT recommend specific study methods — you don't know what they're studying.
- Focus on: writing pattern (steady/declining/absent), comparison to class average, annotation response.
- "Responded to annotation" = wrote more strokes after receiving annotation on that page.
- Keep it factual and observable.

Return JSON only:
{
  "pattern": "2-3 sentences: describe the writing pattern across pages (increasing, decreasing, steady, absent)",
  "annotationResponse": "1-2 sentences: did the student receive annotations? if so, did they respond with additional writing?",
  "attention": "1 sentence: the single most important thing the teacher should note about this student (or 'No concerns' if stable)"
}
Return valid JSON only, no other text.`;
}
