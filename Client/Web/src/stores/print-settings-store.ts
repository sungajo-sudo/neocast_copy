/**
 * Print Settings Store
 * PDF 인쇄 파라메터를 저장하는 store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PrintSettingsState {
  // NCode 발행 설정
  printInBlue: boolean; // 도면을 파란색으로 변환하여 프린트
  ncodeGlyphScale: number; // NCode 글리프 크기 (0.1 ~ 2.0, 기본값 1.0)

  // 설정 변경 메서드
  setPrintInBlue: (value: boolean) => void;
  setNcodeGlyphScale: (value: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  printInBlue: true,
  ncodeGlyphScale: 1.0,
};

export const usePrintSettingsStore = create<PrintSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setPrintInBlue: (value: boolean) => {
        set({ printInBlue: value });
      },

      setNcodeGlyphScale: (value: number) => {
        // 범위 제한: 0.1 ~ 2.0
        const clampedValue = Math.min(2.0, Math.max(0.1, value));
        set({ ncodeGlyphScale: clampedValue });
      },

      resetToDefaults: () => {
        set(DEFAULT_SETTINGS);
      },
    }),
    {
      name: 'neocast-print-settings',
    }
  )
);
