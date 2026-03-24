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

/** 더미 STT 요약 (원본 전사가 아닌 요약 텍스트) */
export const DUMMY_STT_SUMMARY: Record<Locale, string> = {
  ko: '수업 중 음성 대화가 기록되었습니다. 이차방정식의 세 가지 풀이법(인수분해, 완전제곱식, 근의 공식)을 다룬 것으로 보이며, 판별식 관련 질문이 반복적으로 발생했습니다.',
  ja: '授業中の音声会話が記録されました。二次方程式の3つの解法（因数分解、完全平方式、解の公式）を扱い、判別式に関する質問が繰り返し発生しました。',
  'zh-TW': '課堂中的語音對話已記錄。涉及二次方程的三種解法（因式分解、完全平方式、求根公式），判別式相關問題反覆出現。',
  en: 'Voice conversations were recorded during the session. The class covered three methods for solving quadratic equations (factoring, completing the square, quadratic formula), with repeated questions about the discriminant.',
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
