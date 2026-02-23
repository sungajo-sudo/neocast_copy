// 호스트 스트로크 어댑터 스토어
// source의 stroke-store와 동일한 인터페이스 제공
import { create } from 'zustand';
import type { Stroke, NcodePageAddress, PaperSize } from '../types/neocast';
import { formatPageAddress } from '../types/neocast';

interface HostStrokeState {
  strokes: Map<string, Stroke[]>;   // pageKey → Stroke[]
  activeStrokes: Map<string, Stroke>; // strokeId → Stroke (unused in demo, kept for compatibility)
  paperSize: PaperSize;
  getPageStrokes: (pageAddress: NcodePageAddress) => Stroke[];
  addStroke: (stroke: Stroke) => void;
  setActiveStroke: (id: string, stroke: Stroke) => void;
  removeActiveStroke: (id: string) => void;
  clearStrokes: () => void;
}

export const useStrokeStore = create<HostStrokeState>((set, get) => ({
  strokes: new Map(),
  activeStrokes: new Map(),
  paperSize: 'A4' as PaperSize,

  getPageStrokes: (pageAddress) => {
    const key = formatPageAddress(pageAddress);
    return get().strokes.get(key) ?? [];
  },

  addStroke: (stroke) =>
    set((state) => {
      const key = formatPageAddress(stroke.pageAddress);
      const existing = state.strokes.get(key) ?? [];
      // Deduplicate by id
      if (existing.find((s) => s.id === stroke.id)) return state;
      const next = new Map(state.strokes);
      next.set(key, [...existing, stroke]);
      return { strokes: next };
    }),

  setActiveStroke: (id, stroke) =>
    set((state) => {
      const next = new Map(state.activeStrokes);
      next.set(id, stroke);
      return { activeStrokes: next };
    }),

  removeActiveStroke: (id) =>
    set((state) => {
      const next = new Map(state.activeStrokes);
      next.delete(id);
      return { activeStrokes: next };
    }),

  clearStrokes: () => set({ strokes: new Map(), activeStrokes: new Map() }),
}));
