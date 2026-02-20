import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useStrokeStore } from '../../stores/stroke-store';
import { strokeService } from '../../services/stroke-service';
import { useAlert } from '../../contexts/AlertContext';
import { PenType, PaperSize, PAPER_SIZES } from '../../types';

interface PenToolbarProps {
  className?: string;
}

// 색상 팔레트
const COLOR_PRESETS = [
  { name: 'Black', value: 0xff000000 },
  { name: 'Red', value: 0xffff0000 },
  { name: 'Blue', value: 0xff0000ff },
  { name: 'Green', value: 0xff00aa00 },
  { name: 'Yellow', value: 0xffffff00 },
  { name: 'Orange', value: 0xffff8800 },
  { name: 'Purple', value: 0xff8800ff },
  { name: 'Pink', value: 0xffff00ff },
];

// 두께 프리셋 (mm)
const THICKNESS_PRESETS = [
  { name: 'Fine', value: 0.3 },
  { name: 'Medium', value: 0.5 },
  { name: 'Thick', value: 1.0 },
  { name: 'Bold', value: 2.0 },
];

/**
 * ARGB를 CSS 색상으로 변환
 */
const argbToCss = (argb: number): string => {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * 펜 도구 바
 */
// 용지 크기 옵션
const PAPER_SIZE_OPTIONS: PaperSize[] = [PaperSize.A4, PaperSize.Letter, PaperSize.B4, PaperSize.A5];

export const PenToolbar: React.FC<PenToolbarProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { showConfirm } = useAlert();
  // 스타일러스/터치 입력 설정 사용
  const stylusSettings = useStrokeStore((state) => state.stylusSettings);
  const { penColor, penThickness, penType } = stylusSettings;
  const paperSize = useStrokeStore((state) => state.paperSize);
  const currentPageAddress = useStrokeStore((state) => state.currentPageAddress);

  const setStylusColor = useStrokeStore((state) => state.setStylusColor);
  const setStylusThickness = useStrokeStore((state) => state.setStylusThickness);
  const setStylusType = useStrokeStore((state) => state.setStylusType);
  const setPaperSize = useStrokeStore((state) => state.setPaperSize);

  /**
   * Undo 처리
   */
  const handleUndo = useCallback(() => {
    strokeService.undo();
  }, []);

  /**
   * Redo 처리
   */
  const handleRedo = useCallback(() => {
    strokeService.redo();
  }, []);

  /**
   * 페이지 클리어
   */
  const handleClear = useCallback(async () => {
    if (await showConfirm(t('canvas.clearConfirm'))) {
      strokeService.clearPageByAddress(currentPageAddress);
    }
  }, [currentPageAddress, showConfirm, t]);

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      {/* 용지 크기 선택 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('pen.paperSize')}
        </label>
        <select
          value={paperSize}
          onChange={(e) => setPaperSize(e.target.value as PaperSize)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
        >
          {PAPER_SIZE_OPTIONS.map((size) => {
            const info = PAPER_SIZES[size];
            return (
              <option key={size} value={size}>
                {info.name} ({info.widthMm} × {info.heightMm} mm)
              </option>
            );
          })}
        </select>
      </div>

      {/* 구분선 */}
      <hr className="my-4 border-gray-200" />

      {/* 펜 타입 선택 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('pen.penType')}
        </label>
        <div className="flex space-x-2">
          <button
            onClick={() => setStylusType(PenType.Pen)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              penType === PenType.Pen
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('pen.pen')}
          </button>
          <button
            onClick={() => setStylusType(PenType.Highlighter)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              penType === PenType.Highlighter
                ? 'bg-yellow-400 text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('pen.highlighter')}
          </button>
          <button
            onClick={() => setStylusType(PenType.Eraser)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              penType === PenType.Eraser
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('pen.eraser')}
          </button>
        </div>
      </div>

      {/* 색상 선택 */}
      {penType !== PenType.Eraser && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('pen.color')}
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color.name}
                onClick={() => setStylusColor(color.value)}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  penColor === color.value
                    ? 'border-blue-500 scale-110'
                    : 'border-gray-300 hover:scale-105'
                }`}
                style={{ backgroundColor: argbToCss(color.value) }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* 두께 선택 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('pen.thickness')}
        </label>
        <div className="flex space-x-2">
          {THICKNESS_PRESETS.map((thickness) => (
            <button
              key={thickness.name}
              onClick={() => setStylusThickness(thickness.value)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                penThickness === thickness.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {thickness.name}
            </button>
          ))}
        </div>
      </div>

      {/* 두께 슬라이더 */}
      <div className="mb-4">
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={penThickness}
          onChange={(e) => setStylusThickness(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-sm text-gray-500">
          {penThickness.toFixed(1)} mm
        </div>
      </div>

      {/* 구분선 */}
      <hr className="my-4 border-gray-200" />

      {/* 액션 버튼 */}
      <div className="flex space-x-2">
        <button
          onClick={handleUndo}
          className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          ↩ {t('canvas.undo')}
        </button>
        <button
          onClick={handleRedo}
          className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          ↪ {t('canvas.redo')}
        </button>
        <button
          onClick={handleClear}
          className="flex-1 py-2 px-3 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
        >
          {t('canvas.clear')}
        </button>
      </div>
    </div>
  );
};

export default PenToolbar;
