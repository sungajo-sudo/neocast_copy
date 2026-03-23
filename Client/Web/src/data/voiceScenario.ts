// src/data/voiceScenario.ts

export type Locale = 'ko' | 'ja' | 'zh-TW' | 'en';

export interface VoiceEvent {
  timestamp: string;
  pageNumber: number;
  speaker: 'host' | 'student';
  studentId?: string;
  studentName?: string;
  type: 'explanation' | 'question' | 'answer' | 'feedback';
  transcript: string;
}

export interface SessionMeta {
  name: string;
  duration: number;
  studentCount: number;
  locale: Locale;
}

export interface StudentInfo {
  id: string;
  name: string;
  activityTime: number;
  participatedPages: number;
  feedbackCount: number;
}

// 더미 음성 이벤트
export const VOICE_EVENTS: VoiceEvent[] = [
  { timestamp: '14:05', pageNumber: 1, speaker: 'host', type: 'explanation',
    transcript: '오늘은 이차방정식의 풀이 방법 세 가지를 다룹니다. 인수분해, 완전제곱식, 근의 공식 순서로 진행할게요.' },

  { timestamp: '14:15', pageNumber: 2, speaker: 'student',
    studentId: 's1', studentName: '김민지', type: 'question',
    transcript: '선생님, 판별식이 0일 때는 어떻게 되나요?' },
  { timestamp: '14:16', pageNumber: 2, speaker: 'host', type: 'answer',
    transcript: '판별식이 0이면 중근이에요. x = -b/2a 값 하나만 나와요. 두 근이 같다는 뜻이죠.' },

  { timestamp: '14:28', pageNumber: 3, speaker: 'student',
    studentId: 's3', studentName: '박지우', type: 'question',
    transcript: '인수분해가 안 되는 경우에도 근의 공식 쓰면 되나요?' },
  { timestamp: '14:29', pageNumber: 3, speaker: 'host', type: 'answer',
    transcript: '맞아요. 인수분해가 안 보이면 바로 근의 공식으로 가는 게 안전해요.' },

  { timestamp: '14:38', pageNumber: 5, speaker: 'student',
    studentId: 's2', studentName: '이서준', type: 'question',
    transcript: '판별식이 음수면 답이 없는 건가요?' },
  { timestamp: '14:39', pageNumber: 5, speaker: 'host', type: 'answer',
    transcript: '실수 범위에서는 없어요. 허근이 존재하는데 고등과정에서 다루게 돼요.' },

  { timestamp: '14:42', pageNumber: 5, speaker: 'host', type: 'feedback',
    transcript: '김민지 학생, 5번 풀이에서 부호 실수가 있어요. -b 할 때 괄호 꼭 치는 습관 들이세요.' },

  { timestamp: '14:51', pageNumber: 7, speaker: 'student',
    studentId: 's5', studentName: '정현우', type: 'question',
    transcript: '완전제곱식 방법이 근의 공식보다 더 복잡한 거 아닌가요?' },
  { timestamp: '14:52', pageNumber: 7, speaker: 'host', type: 'answer',
    transcript: '개념 이해할 때는 완전제곱식이 더 직관적이에요. 근의 공식이 여기서 유도되거든요.' },
];

// 톤 가이드 (locale별)
const TONE_GUIDE: Record<Locale, string> = {
  ko: '학생과 학부모가 이해할 수 있는 친절한 톤으로 한국어로 작성하세요.',
  ja: '保護者と生徒が理解しやすい丁寧な日本語で作成してください。',
  'zh-TW': '請以家長和學生易於理解的親切語氣，用繁體中文撰寫。',
  en: 'Write in clear, constructive English suitable for parents and students.',
};

// 문화 가이드 (locale별)
const CULTURE_GUIDE: Record<Locale, string> = {
  ko: '',
  ja: '生徒が発言しないことを否定的に評価しないでください。日本の教育文化では、静かに集中して聞くことも積極的な学習態度です。',
  'zh-TW': '不要將學生未發言視為消極表現。',
  en: 'Do not interpret silence as lack of engagement. Some students prefer to listen and process internally.',
};

// 세션 전체 요약 프롬프트
export function buildSessionPrompt(
  sessionMeta: SessionMeta,
  voiceEvents: VoiceEvent[],
  strokeStats: string,
): string {
  const locale = sessionMeta.locale;
  return `You are a class analysis AI. Generate a lesson summary report for the teacher.
${TONE_GUIDE[locale]}
${CULTURE_GUIDE[locale]}
Use terminology appropriate to the local education system. Do not reference other countries' curricula.

[Session Info]
- Class: ${sessionMeta.name}
- Duration: ${sessionMeta.duration} min
- Students: ${sessionMeta.studentCount}

[Voice Events]
${voiceEvents.map(e =>
  `${e.timestamp} [P${e.pageNumber}] ${e.speaker === 'host' ? 'Teacher' : e.studentName} (${e.type}): ${e.transcript}`
).join('\n')}

[Writing Activity]
${strokeStats}

Do not make value judgments about students who did not speak.
Base participation analysis on writing data, not voice activity alone.

Return JSON only:
{
  "summary": "3-sentence lesson flow summary",
  "keyConcepts": ["array of key concept tags"],
  "questionHotspot": "Where questions concentrated and likely cause (2 sentences)",
  "nextClassRecommendation": "Recommendation for next class (2 sentences)"
}
Return JSON only, no other text.`;
}

// 학생 개인 분석 프롬프트
export function buildStudentPrompt(
  student: StudentInfo,
  studentVoiceEvents: VoiceEvent[],
  strokeData: string,
  locale: Locale,
): string {
  return `You are a learning analysis AI. Write a personal report for a student.
${TONE_GUIDE[locale]}
${CULTURE_GUIDE[locale]}
Use terminology appropriate to the local education system. Do not reference other countries' curricula.
Recommend practice methods using neutral terms like "practice problems" instead of culture-specific terms.

[Student Info]
- Name: ${student.name}
- Activity time: ${student.activityTime} min
- Pages participated: ${student.participatedPages}
- Feedback received: ${student.feedbackCount}

[Voice Records]
${studentVoiceEvents.length > 0
  ? studentVoiceEvents.map(e =>
      `${e.timestamp} [P${e.pageNumber}] ${e.type === 'question' ? 'Q' : 'A'}: ${e.transcript}`
    ).join('\n')
  : 'No voice records in this session.'}

[Writing Density]
${strokeData}

Important:
- Do not treat absence of voice records as negative.
- Evaluate based on writing data when voice data is unavailable.
- Keep recommendations actionable and specific.

Return JSON only:
{
  "currentStatus": "2-3 sentence learning status",
  "strengths": "1-2 sentence strengths",
  "improvements": "Specific areas to improve",
  "studyRecommendation": "2-3 sentence specific study method"
}
Return JSON only, no other text.`;
}
