import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStrokeStore } from '../../stores/stroke-store';
import { PenType } from '../../types';

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
 * Pen 설정 팝오버 (Top bar용 - 스타일러스/터치 입력용)
 */
export const PenSettingsPopover: React.FC = () => {
  const { t } = useTranslation();
  const stylusSettings = useStrokeStore((state) => state.stylusSettings);
  const { penColor, penThickness, penType } = stylusSettings;

  const setStylusColor = useStrokeStore((state) => state.setStylusColor);
  const setStylusThickness = useStrokeStore((state) => state.setStylusThickness);
  const setStylusType = useStrokeStore((state) => state.setStylusType);

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 현재 펜 타입 아이콘
  const getPenIcon = () => {
    if (penType === PenType.Eraser) {
      return (
        <div className="w-5 h-5 rounded-full border-2 border-gray-600 border-dashed bg-transparent" />
      );
    }

    // Thickness -> Size mapping
    // 0.3mm -> ~10px, 2.0mm -> ~18px
    const sizePx = Math.min(18, Math.max(8, 8 + penThickness * 5));
    const style = {
      width: `${sizePx}px`,
      height: `${sizePx}px`,
      backgroundColor: argbToCss(penColor),
    };

    if (penType === PenType.Highlighter) {
      return (
        <div
          className="rounded-full transition-all"
          style={{
            ...style,
            boxShadow: `0 0 6px ${style.backgroundColor}, 0 0 10px ${style.backgroundColor}`,
            opacity: 0.8,
          }}
        />
      );
    }

    return (
      <div className="rounded-full transition-all" style={style} />
    );
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-7 h-7 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors bg-gray-100"
        title={t('pen.penSettings')}
      >
        {getPenIcon()}
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 top-full mt-1 w-64 bg-white/90 backdrop-blur-xl rounded-lg shadow-lg border border-white/50 p-3 z-50">
          {/* 펜 타입 선택 */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('pen.penType')}</label>
            <div className="flex space-x-1">
              <button
                onClick={() => setStylusType(PenType.Pen)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${penType === PenType.Pen
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {t('pen.pen')}
              </button>
              <button
                onClick={() => setStylusType(PenType.Highlighter)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${penType === PenType.Highlighter
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {t('pen.highlighter')}
              </button>
              <button
                onClick={() => setStylusType(PenType.Eraser)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${penType === PenType.Eraser
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {t('pen.eraser')}
              </button>
            </div>
          </div>

          {/* 색상 선택 (Eraser 아닐 때만) */}
          {penType !== PenType.Eraser && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('pen.color')}</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setStylusColor(color.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${penColor === color.value
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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('pen.thickness')}</label>
            <div className="flex space-x-1 mb-2">
              {THICKNESS_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setStylusThickness(preset.value)}
                  className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${penThickness === preset.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={penThickness}
              onChange={(e) => setStylusThickness(parseFloat(e.target.value))}
              className="w-full h-1.5"
            />
            <div className="text-center text-xs text-gray-500 mt-0.5">
              {penThickness.toFixed(1)} mm
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PenSettingsPopover;
