import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface PageInfo {
    id: string;
    label: string;   // "1페이지", "2페이지", ...
    createdAt: number;
}

interface PageStore {
    pages: PageInfo[];
    currentPageId: string | null;

    addPage: () => string;               // 페이지 추가 → 새 pageId 반환
    setCurrentPage: (id: string) => void;
    deletePage: (id: string) => void;
    initializeFirstPage: () => void;     // 세션 진입 시 첫 페이지 생성

    getPageIndex: (id: string) => number; // 0-based index
    reset: () => void;
}

export const usePageStore = create<PageStore>((set, get) => ({
    pages: [],
    currentPageId: null,

    addPage: () => {
        const { pages } = get();
        const id = uuidv4();
        const label = `${pages.length + 1}페이지`;
        const newPage: PageInfo = { id, label, createdAt: Date.now() };
        set({ pages: [...pages, newPage], currentPageId: id });
        return id;
    },

    setCurrentPage: (id) => {
        const { pages } = get();
        if (pages.find((p) => p.id === id)) {
            set({ currentPageId: id });
        }
    },

    deletePage: (id) => {
        const { pages, currentPageId } = get();
        const remaining = pages.filter((p) => p.id !== id);
        if (remaining.length === 0) return; // 마지막 페이지는 삭제 불가
        const newCurrent =
            currentPageId === id ? remaining[remaining.length - 1].id : currentPageId;
        set({ pages: remaining, currentPageId: newCurrent });
    },

    initializeFirstPage: () => {
        const { pages } = get();
        if (pages.length > 0) return; // 이미 있으면 무시
        const id = uuidv4();
        set({ pages: [{ id, label: '1페이지', createdAt: Date.now() }], currentPageId: id });
    },

    getPageIndex: (id) => get().pages.findIndex((p) => p.id === id),

    reset: () => set({ pages: [], currentPageId: null }),
}));
