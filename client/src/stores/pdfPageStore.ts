import { create } from 'zustand';

interface PdfPageState {
    imageUrl: string | null;
    totalPages: number;
    currentPage: number;
    opacity: number;          // 0→1 fade-in (첫 stroke 감지 후 애니메이션)
    setImageUrl: (url: string | null) => void;
    setTotalPages: (n: number) => void;
    setCurrentPage: (n: number) => void;
    setOpacity: (n: number) => void;
    reset: () => void;
}

export const usePdfPageStore = create<PdfPageState>(set => ({
    imageUrl: null,
    totalPages: 0,
    currentPage: 1,
    opacity: 0,              // 기본 0 — 첫 stroke 전까지 숨김
    setImageUrl: url => set({ imageUrl: url }),
    setTotalPages: n => set({ totalPages: n }),
    setCurrentPage: n => set({ currentPage: n }),
    setOpacity: n => set({ opacity: n }),
    reset: () => set({ imageUrl: null, totalPages: 0, currentPage: 1, opacity: 0 }),
}));
