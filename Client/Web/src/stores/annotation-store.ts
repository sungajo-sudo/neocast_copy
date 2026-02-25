import { create } from 'zustand';

export interface AnnotationStroke {
  points: { x: number; y: number }[]; // normalized 0-1 coordinates
  color: string;
  lineWidth: number;
}

interface AnnotationStore {
  /** userId → 해당 사용자 캔버스에 그려진 첨삭 스트로크 목록 */
  annotations: Map<string, AnnotationStroke[]>;

  addAnnotation: (targetUserId: string, stroke: AnnotationStroke) => void;
  clearAnnotations: (targetUserId: string) => void;
  clearAll: () => void;
  getAnnotations: (targetUserId: string) => AnnotationStroke[];
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: new Map(),

  addAnnotation: (targetUserId, stroke) => {
    set((state) => {
      const next = new Map(state.annotations);
      const existing = next.get(targetUserId) ?? [];
      next.set(targetUserId, [...existing, stroke]);
      return { annotations: next };
    });
  },

  clearAnnotations: (targetUserId) => {
    set((state) => {
      const next = new Map(state.annotations);
      next.delete(targetUserId);
      return { annotations: next };
    });
  },

  clearAll: () => set({ annotations: new Map() }),

  getAnnotations: (targetUserId) => {
    return get().annotations.get(targetUserId) ?? [];
  },
}));
