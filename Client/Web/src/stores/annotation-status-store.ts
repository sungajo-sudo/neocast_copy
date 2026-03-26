/**
 * 첨삭 활성 상태 추적 스토어
 *
 * 호스트가 특정 학생에게 첨삭 중인지 추적.
 * 게스트 측에서는 자신이 첨삭 대상인지 확인하여 배너/글로우 표시.
 * 마지막 첨삭 스트로크 후 3초 뒤 자동 해제.
 */

import { create } from 'zustand';

interface AnnotationStatusStore {
  /** 현재 첨삭 중인 userId 목록 */
  activeAnnotationTargets: Set<string>;

  /** 첨삭 시작/갱신 (3초 디바운스 타이머) */
  setAnnotating: (userId: string) => void;

  /** 첨삭 종료 */
  clearAnnotating: (userId: string) => void;

  /** 특정 사용자가 첨삭 대상인지 확인 */
  isAnnotating: (userId: string) => boolean;
}

// 타이머 저장 (스토어 외부에서 관리)
const clearTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export const useAnnotationStatusStore = create<AnnotationStatusStore>((set, get) => ({
  activeAnnotationTargets: new Set(),

  setAnnotating: (userId) => {
    // 기존 타이머 취소
    const existing = clearTimeouts.get(userId);
    if (existing) clearTimeout(existing);

    // 활성 상태로 설정
    set((state) => {
      const next = new Set(state.activeAnnotationTargets);
      next.add(userId);
      return { activeAnnotationTargets: next };
    });

    // 3초 후 자동 해제
    const timeout = setTimeout(() => {
      get().clearAnnotating(userId);
      clearTimeouts.delete(userId);
    }, 3000);
    clearTimeouts.set(userId, timeout);
  },

  clearAnnotating: (userId) => {
    const existing = clearTimeouts.get(userId);
    if (existing) {
      clearTimeout(existing);
      clearTimeouts.delete(userId);
    }

    set((state) => {
      const next = new Set(state.activeAnnotationTargets);
      next.delete(userId);
      return { activeAnnotationTargets: next };
    });
  },

  isAnnotating: (userId) => {
    return get().activeAnnotationTargets.has(userId);
  },
}));
