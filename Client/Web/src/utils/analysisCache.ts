const CACHE_PREFIX = 'nc_ai_analysis_';
const CACHE_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24시간

export interface AnalysisCache {
  sessionId: string;
  sessionResult: string | null;
  studentResults: Record<string, string>; // studentId → 분석 텍스트(JSON)
  generatedAt: number;
}

export function getAnalysisCache(sessionId: string): AnalysisCache | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${sessionId}`);
    if (!raw) return null;
    const cache: AnalysisCache = JSON.parse(raw);
    if (Date.now() - cache.generatedAt > CACHE_EXPIRY_MS) {
      localStorage.removeItem(`${CACHE_PREFIX}${sessionId}`);
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

export function setAnalysisCache(
  sessionId: string,
  data: Partial<Omit<AnalysisCache, 'sessionId' | 'generatedAt'>>
): void {
  const existing = getAnalysisCache(sessionId) ?? {
    sessionId,
    sessionResult: null,
    studentResults: {},
    generatedAt: Date.now(),
  };
  const updated: AnalysisCache = {
    ...existing,
    ...data,
    generatedAt: Date.now(),
  };
  localStorage.setItem(`${CACHE_PREFIX}${sessionId}`, JSON.stringify(updated));
}

export function clearAnalysisCache(sessionId: string): void {
  localStorage.removeItem(`${CACHE_PREFIX}${sessionId}`);
}
