export interface PageParticipation {
  pageId: string;              // 'P1', 'P2', ...
  participationRate: number;   // 0~100
  hasWriting: boolean;         // false = 미필기
}

export interface StudentParticipation {
  studentId: string;
  studentName: string;
  pages: PageParticipation[];
  overallRate: number;
}

export const PARTICIPATION_THRESHOLD = {
  high: 70,   // 70% 이상 → 양호
  mid: 40,    // 40~69% → 주의
  low: 0,     // 40% 미만 → 부진
} as const;

export type ParticipationLevel = 'high' | 'mid' | 'low' | 'none';
// none = 미필기

export function getParticipationLevel(
  rate: number,
  hasWriting: boolean
): ParticipationLevel {
  if (!hasWriting) return 'none';
  if (rate >= PARTICIPATION_THRESHOLD.high) return 'high';
  if (rate >= PARTICIPATION_THRESHOLD.mid) return 'mid';
  return 'low';
}
