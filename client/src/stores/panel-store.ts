import { create } from 'zustand';

export type LeftPanelType = 'pages' | null;
export type RightPanelType = 'participants' | null;

interface PanelStore {
    // 왼쪽 패널 (페이지 목록 등)
    activeLeftPanel: LeftPanelType;
    toggleLeftPanel: (panel: LeftPanelType) => void;
    setActiveLeftPanel: (panel: LeftPanelType) => void;

    // 오른쪽 패널 (참가자 등)
    activeRightPanel: RightPanelType;
    toggleRightPanel: (panel: RightPanelType) => void;
    setActiveRightPanel: (panel: RightPanelType) => void;

    // PDF 업로드 모달
    isPdfUploadOpen: boolean;
    setPdfUploadOpen: (open: boolean) => void;
    togglePdfUpload: () => void;

    // 배경 이미지 URL (업로드 후 전역 공유)
    backgroundUrl: string | null;
    setBackgroundUrl: (url: string | null) => void;

    // 마이크
    isMicOn: boolean;
    setMicOn: (on: boolean) => void;
    toggleMic: () => void;

    // 터치/펜스트림
    isPenStreamOn: boolean;
    togglePenStream: () => void;
}

export const usePanelStore = create<PanelStore>((set, get) => ({
    activeLeftPanel: null,
    toggleLeftPanel: (panel) =>
        set((s) => ({ activeLeftPanel: s.activeLeftPanel === panel ? null : panel })),
    setActiveLeftPanel: (panel) => set({ activeLeftPanel: panel }),

    activeRightPanel: null,
    toggleRightPanel: (panel) =>
        set((s) => ({ activeRightPanel: s.activeRightPanel === panel ? null : panel })),
    setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),

    isPdfUploadOpen: false,
    setPdfUploadOpen: (open) => set({ isPdfUploadOpen: open }),
    togglePdfUpload: () => set((s) => ({ isPdfUploadOpen: !s.isPdfUploadOpen })),

    backgroundUrl: null,
    setBackgroundUrl: (url) => set({ backgroundUrl: url }),

    isMicOn: false,
    setMicOn: (on) => set({ isMicOn: on }),
    toggleMic: () => set((s) => ({ isMicOn: !s.isMicOn })),

    isPenStreamOn: true,
    togglePenStream: () => set((s) => ({ isPenStreamOn: !s.isPenStreamOn })),
}));
