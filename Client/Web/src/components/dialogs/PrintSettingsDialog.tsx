/**
 * Print Settings Dialog
 * NCode PDF 인쇄 설정 다이얼로그
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrintSettingsStore } from '../../stores/print-settings-store';

export interface PrintSettings {
  printInBlue: boolean;
  ncodeGlyphScale: number;
}

interface PrintSettingsDialogProps {
  isOpen: boolean;
  onConfirm: (settings: PrintSettings) => void;
  onCancel: () => void;
  confirmLabel?: string;
}

export function PrintSettingsDialog({
  isOpen,
  onConfirm,
  onCancel,
  confirmLabel,
}: PrintSettingsDialogProps) {
  const { t } = useTranslation();
  const {
    printInBlue: defaultPrintInBlue,
    ncodeGlyphScale: defaultGlyphScale,
    setPrintInBlue: saveDefaultPrintInBlue,
    setNcodeGlyphScale: saveDefaultGlyphScale,
  } = usePrintSettingsStore();

  // 임시 설정 값 (다이얼로그 내에서만 사용)
  const [tempPrintInBlue, setTempPrintInBlue] = useState(defaultPrintInBlue);
  const [tempGlyphScale, setTempGlyphScale] = useState(defaultGlyphScale);

  // 다이얼로그가 열릴 때마다 기본값으로 초기화
  useEffect(() => {
    if (isOpen) {
      setTempPrintInBlue(defaultPrintInBlue);
      setTempGlyphScale(defaultGlyphScale);
    }
  }, [isOpen, defaultPrintInBlue, defaultGlyphScale]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // 설정을 기본값으로 저장
    saveDefaultPrintInBlue(tempPrintInBlue);
    saveDefaultGlyphScale(tempGlyphScale);

    onConfirm({
      printInBlue: tempPrintInBlue,
      ncodeGlyphScale: tempGlyphScale,
    });
  };

  const handleGlyphScaleChange = (value: number) => {
    // 범위 제한: 0.1 ~ 2.0
    const clampedValue = Math.min(2.0, Math.max(0.1, value));
    setTempGlyphScale(clampedValue);
  };

  const handleReset = () => {
    setTempPrintInBlue(true);
    setTempGlyphScale(1.0);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 bg-blue-500 text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <span className="font-semibold">{t('printSettings.title', 'Print Settings')}</span>
        </div>

        {/* 본문 */}
        <div className="p-5">
          {/* 블루프린트 설정 */}
          <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-200">
            <div className="flex-1">
              <label className="font-semibold text-sm text-gray-800 block mb-1">
                {t('printSettings.printInBlue', 'Blueprint Mode')}
              </label>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t('printSettings.printInBlueDesc', 'Convert document colors to blue for easier distinction from printed NCode pattern')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={tempPrintInBlue}
                onChange={(e) => setTempPrintInBlue(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          {/* NCode 글리프 크기 설정 */}
          <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-200">
            <div className="flex-1">
              <label className="font-semibold text-sm text-gray-800 block mb-1">
                {t('printSettings.ncodeGlyphScale', 'NCode Dot Size')}
              </label>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t('printSettings.ncodeGlyphScaleDesc', 'Adjust NCode pattern dot size (0.1 ~ 2.0)')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={tempGlyphScale}
                onChange={(e) => handleGlyphScaleChange(parseFloat(e.target.value))}
                className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 w-8 text-right">
                {tempGlyphScale.toFixed(1)}
              </span>
            </div>
          </div>

          {/* 리셋 버튼 */}
          <div className="pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {t('printSettings.resetToDefaults', 'Reset to defaults')}
            </button>
          </div>

          {/* 안내 메시지 */}
          <div className="flex items-start gap-2 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-blue-700 leading-relaxed">
              {t('printSettings.note', 'These settings will be saved and used as defaults for future prints.')}
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex gap-3 p-5 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 px-4 border border-gray-300 rounded-lg bg-white text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {confirmLabel || t('printSettings.download', 'Download')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrintSettingsDialog;
