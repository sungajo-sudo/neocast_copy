// 데모용 stroke 스토어 (zustand)
// 기존 neocast의 stroke-store와 독립적으로 동작
import { create } from 'zustand';

export interface StrokePoint {
    x: number;
    y: number;
    pressure: number;
}

export interface Stroke {
    id: string;
    userId: string;
    color: string;
    lineWidth: number;
    points: StrokePoint[];
    done: boolean;
}

export interface DemoStrokeStore {
    // userId → Stroke[]
    strokes: Map<string, Stroke[]>;
    activeStrokes: Map<string, Stroke>; // strokeId → Stroke

    addStroke: (userId: string, stroke: Stroke) => void;
    updateActiveStroke: (strokeId: string, stroke: Stroke) => void;
    finalizeStroke: (strokeId: string) => void;
    clearUserStrokes: (userId: string) => void;
    getStrokes: (userId: string) => Stroke[];
}

export const useDemoStrokeStore = create<DemoStrokeStore>((set, get) => ({
    strokes: new Map(),
    activeStrokes: new Map(),

    addStroke: (userId, stroke) => {
        set(state => {
            const next = new Map(state.strokes);
            const arr = next.get(userId) ?? [];
            next.set(userId, [...arr, stroke]);
            return { strokes: next };
        });
    },

    updateActiveStroke: (strokeId, stroke) => {
        set(state => {
            const next = new Map(state.activeStrokes);
            next.set(strokeId, stroke);
            return { activeStrokes: next };
        });
    },

    finalizeStroke: (strokeId) => {
        set(state => {
            const stroke = state.activeStrokes.get(strokeId);
            if (!stroke) return state;

            const nextActive = new Map(state.activeStrokes);
            nextActive.delete(strokeId);

            const nextStrokes = new Map(state.strokes);
            const arr = nextStrokes.get(stroke.userId) ?? [];
            nextStrokes.set(stroke.userId, [...arr, { ...stroke, done: true }]);

            return { activeStrokes: nextActive, strokes: nextStrokes };
        });
    },

    clearUserStrokes: (userId) => {
        set(state => {
            const next = new Map(state.strokes);
            next.delete(userId);
            return { strokes: next };
        });
    },

    getStrokes: (userId) => {
        const state = get();
        return state.strokes.get(userId) ?? [];
    },
}));
