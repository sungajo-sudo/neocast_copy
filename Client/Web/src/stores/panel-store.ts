import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 오른쪽 패널 타입
 */
export type RightPanelType = 'participants' | 'chat' | null;

/**
 * 왼쪽 패널 타입
 */
export type LeftPanelType = 'pages' | 'myPapers' | null;

/**
 * 패널 상태 관리 스토어
 * - 하단 컨트롤 바 버튼들의 활성 상태
 * - 오른쪽 패널 표시 상태
 * - 팝업/모달 상태
 */
interface PanelStore {
  // 오른쪽 패널
  activeRightPanel: RightPanelType;
  setActiveRightPanel: (panel: RightPanelType) => void;
  toggleRightPanel: (panel: RightPanelType) => void;

  // 왼쪽 패널
  activeLeftPanel: LeftPanelType;
  setActiveLeftPanel: (panel: LeftPanelType) => void;
  toggleLeftPanel: (panel: LeftPanelType) => void;
  leftPanelWidth: number;
  setLeftPanelWidth: (width: number) => void;

  // 오른쪽 패널 너비
  rightPanelWidth: number;
  setRightPanelWidth: (width: number) => void;

  // 마이크 상태
  isMicOn: boolean;
  setMicOn: (on: boolean) => void;
  toggleMic: () => void;

  // PenStream 상태 (마우스/터치 입력)
  isPenStreamOn: boolean;
  setPenStreamOn: (on: boolean) => void;
  togglePenStream: () => void;

  // Stylus 상태 (스타일러스 입력)
  isStylusOn: boolean;
  setStylusOn: (on: boolean) => void;
  toggleStylus: () => void;

  // Modifier 키 상태 (CMD/CTRL) - 눌려있으면 터치 자동 비활성화
  isModifierKeyPressed: boolean;
  setModifierKeyPressed: (pressed: boolean) => void;

  // 실제 Stylus 활성 상태 (사용자 설정 && !modifier키)
  effectiveStylusOn: () => boolean;

  // 모달/팝업 상태
  isMessengerOpen: boolean;
  setMessengerOpen: (open: boolean) => void;
  toggleMessenger: () => void;

  isSettingsOpen: boolean;
  settingsInitialTab: string | null;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  openSettingsTab: (tab: string) => void;

  isMoreMenuOpen: boolean;
  setMoreMenuOpen: (open: boolean) => void;
  toggleMoreMenu: () => void;

  isPdfUploadOpen: boolean;
  setPdfUploadOpen: (open: boolean) => void;
  togglePdfUpload: () => void;

  isLeaveConfirmOpen: boolean;
  setLeaveConfirmOpen: (open: boolean) => void;

  isAboutOpen: boolean;
  setAboutOpen: (open: boolean) => void;
  toggleAbout: () => void;

  // 채팅 관련
  unreadChatCount: number;
  incrementUnreadChat: () => void;
  clearUnreadChat: () => void;

  // 메신저 관련
  unreadMessengerCount: number;
  setUnreadMessengerCount: (count: number) => void;
  incrementUnreadMessenger: () => void;
  clearUnreadMessenger: () => void;

  // 캔버스 줌 잠금 (100% Lock)
  // true: 컨테이너 크기에 맞춰 자동 조정 (fit-to-screen)
  // false: 수동 줌 상태 유지
  isZoomLocked: boolean;
  setZoomLocked: (locked: boolean) => void;

  // 캔버스 줌 상태 (App.tsx에서 표시용)
  canvasScale: number;
  canvasFitScale: number;
  setCanvasScale: (scale: number) => void;
  setCanvasFitScale: (fitScale: number) => void;
  resetZoomToFit: () => void;

  // 글로벌 토스트 메시지
  toastMessage: string | null;
  showToast: (message: string, duration?: number) => void;
  clearToast: () => void;

  // 리셋
  resetPanelState: () => void;
}

const initialState = {
  activeRightPanel: null as RightPanelType,
  activeLeftPanel: null as LeftPanelType,
  leftPanelWidth: 280, // 기본 폭 280px (최소 220px ~ 최대 480px)
  rightPanelWidth: 320, // 기본 폭 320px (최소 280px ~ 최대 480px)
  isMicOn: false,
  isPenStreamOn: true, // 기본적으로 마우스/터치 입력 활성화
  isStylusOn: true, // 기본적으로 스타일러스 입력 활성화
  isModifierKeyPressed: false, // CMD/CTRL 키 눌림 상태
  isMessengerOpen: false,
  isSettingsOpen: false,
  settingsInitialTab: null as string | null,
  isMoreMenuOpen: false,
  isPdfUploadOpen: false,
  isLeaveConfirmOpen: false,
  isAboutOpen: false,
  unreadChatCount: 0,
  unreadMessengerCount: 0,
  isZoomLocked: true, // 기본적으로 100% Lock ON (화면에 맞춤)
  canvasScale: 1,
  canvasFitScale: 1,
  toastMessage: null as string | null,
};

export const usePanelStore = create<PanelStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 오른쪽 패널
      setActiveRightPanel: (panel) => {
        set({ activeRightPanel: panel });
        // 채팅 패널 열 때 읽지 않은 메시지 초기화
        if (panel === 'chat') {
          set({ unreadChatCount: 0 });
        }
      },
      toggleRightPanel: (panel) => {
        const { activeRightPanel } = get();
        if (activeRightPanel === panel) {
          set({ activeRightPanel: null });
        } else {
          set({ activeRightPanel: panel });
          if (panel === 'chat') {
            set({ unreadChatCount: 0 });
          }
        }
      },

      // 왼쪽 패널
      setActiveLeftPanel: (panel) => set({ activeLeftPanel: panel }),
      toggleLeftPanel: (panel) => {
        const { activeLeftPanel } = get();
        if (activeLeftPanel === panel) {
          set({ activeLeftPanel: null });
        } else {
          set({ activeLeftPanel: panel });
        }
      },
      setLeftPanelWidth: (width) => {
        // 최소 220px, 최대 480px
        const clampedWidth = Math.min(480, Math.max(220, width));
        set({ leftPanelWidth: clampedWidth });
      },
      setRightPanelWidth: (width) => {
        // 최소 280px, 최대 480px
        const clampedWidth = Math.min(480, Math.max(280, width));
        set({ rightPanelWidth: clampedWidth });
      },

      // 마이크
      setMicOn: (on) => set({ isMicOn: on }),
      toggleMic: () => set((state) => ({ isMicOn: !state.isMicOn })),

      // PenStream (마우스/터치)
      setPenStreamOn: (on) => set({ isPenStreamOn: on }),
      togglePenStream: () => set((state) => ({ isPenStreamOn: !state.isPenStreamOn })),

      // Stylus
      setStylusOn: (on) => set({ isStylusOn: on }),
      toggleStylus: () => set((state) => ({ isStylusOn: !state.isStylusOn })),

      // Modifier 키 (CMD/CTRL)
      setModifierKeyPressed: (pressed) => set({ isModifierKeyPressed: pressed }),
      effectiveStylusOn: () => {
        const { isStylusOn, isModifierKeyPressed } = get();
        return isStylusOn && !isModifierKeyPressed;
      },

      // 모달/팝업
      setMessengerOpen: (open) => set({ isMessengerOpen: open }),
      toggleMessenger: () => set((state) => ({ isMessengerOpen: !state.isMessengerOpen })),

      setSettingsOpen: (open) => set({ isSettingsOpen: open, settingsInitialTab: null }),
      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, settingsInitialTab: null })),
      openSettingsTab: (tab) => set({ isSettingsOpen: true, settingsInitialTab: tab }),

      setMoreMenuOpen: (open) => set({ isMoreMenuOpen: open }),
      toggleMoreMenu: () => set((state) => ({ isMoreMenuOpen: !state.isMoreMenuOpen })),

      setPdfUploadOpen: (open) => set({ isPdfUploadOpen: open }),
      togglePdfUpload: () => set((state) => ({ isPdfUploadOpen: !state.isPdfUploadOpen })),

      setLeaveConfirmOpen: (open) => set({ isLeaveConfirmOpen: open }),

      setAboutOpen: (open) => set({ isAboutOpen: open }),
      toggleAbout: () => set((state) => ({ isAboutOpen: !state.isAboutOpen })),

      // 채팅
      incrementUnreadChat: () => {
        const { activeRightPanel } = get();
        // 채팅 패널이 열려있지 않을 때만 카운트 증가
        if (activeRightPanel !== 'chat') {
          set((state) => ({ unreadChatCount: state.unreadChatCount + 1 }));
        }
      },
      clearUnreadChat: () => set({ unreadChatCount: 0 }),

      // 메신저
      setUnreadMessengerCount: (count) => set({ unreadMessengerCount: count }),
      incrementUnreadMessenger: () => {
        const { isMessengerOpen } = get();
        // 메신저가 열려있지 않을 때만 카운트 증가
        if (!isMessengerOpen) {
          set((state) => ({ unreadMessengerCount: state.unreadMessengerCount + 1 }));
        }
      },
      clearUnreadMessenger: () => set({ unreadMessengerCount: 0 }),

      // 캔버스 줌 잠금
      setZoomLocked: (locked) => set({ isZoomLocked: locked }),

      // 캔버스 줌 상태
      setCanvasScale: (scale) => set({ canvasScale: scale }),
      setCanvasFitScale: (fitScale) => set({ canvasFitScale: fitScale }),
      resetZoomToFit: () => {
        const { canvasFitScale } = get();
        set({ isZoomLocked: true, canvasScale: canvasFitScale });
      },

      // 글로벌 토스트
      showToast: (message, duration = 2000) => {
        set({ toastMessage: message });
        setTimeout(() => {
          set({ toastMessage: null });
        }, duration);
      },
      clearToast: () => set({ toastMessage: null }),

      // 리셋
      resetPanelState: () => set(initialState),
    }),
    {
      name: 'neocast:panel-state',
      partialize: (state) => ({
        // 영구 저장할 상태만 선택
        isMicOn: state.isMicOn,
        isPenStreamOn: state.isPenStreamOn,
        isStylusOn: state.isStylusOn,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
      }),
    }
  )
);
