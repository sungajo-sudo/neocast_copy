import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore, type GridLayout } from '../../stores/session-store';

interface GridSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (layout: GridLayout) => void;
  onAutoLayout?: () => void;
}

const MAX_GRID = 6;

/**
 * 그리드 선택 팝업 컴포넌트
 * - 6x6 격자에서 드래그로 rows x cols 선택
 * - OK 버튼으로 확정
 */
export const GridSelector: React.FC<GridSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  onAutoLayout,
}) => {
  const { t } = useTranslation();
  const gridLayout = useSessionStore((state) => state.gridLayout);
  const [selection, setSelection] = useState<GridLayout>(gridLayout);
  const [isDragging, setIsDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // 셀 호버/드래그 시 선택 업데이트
  const handleCellInteraction = useCallback((row: number, col: number) => {
    setSelection({ rows: row + 1, cols: col + 1 });
  }, []);

  // 마우스 다운 (드래그 시작)
  const handleMouseDown = useCallback((row: number, col: number) => {
    setIsDragging(true);
    handleCellInteraction(row, col);
  }, [handleCellInteraction]);

  // 마우스 엔터 (드래그 중 셀 진입)
  const handleMouseEnter = useCallback((row: number, col: number) => {
    if (isDragging) {
      handleCellInteraction(row, col);
    }
  }, [isDragging, handleCellInteraction]);

  // 마우스 업 (드래그 종료)
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 선택 확정
  const handleConfirm = useCallback(() => {
    onSelect(selection);
    onClose();
  }, [selection, onSelect, onClose]);

  // 셀 클릭 (드래그 없이 직접 클릭)
  const handleCellClick = useCallback((row: number, col: number) => {
    setSelection({ rows: row + 1, cols: col + 1 });
  }, []);

  // 자동 레이아웃
  const handleAutoLayout = useCallback(() => {
    onAutoLayout?.();
    onClose();
  }, [onAutoLayout, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* 팝업 */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          minWidth: '280px',
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <h3 className="text-lg font-semibold mb-3 text-center">{t('grid.changeGrid')}</h3>

        {/* 현재 선택 표시 */}
        <div className="text-center mb-3">
          <span className="text-2xl font-bold text-blue-600">
            {selection.cols} x {selection.rows}
          </span>
          <span className="text-sm text-gray-500 ml-2">
            ({selection.cols * selection.rows})
          </span>
        </div>

        {/* 6x6 그리드 */}
        <div
          ref={gridRef}
          className="inline-grid gap-1 p-2 bg-gray-100 rounded-lg mx-auto"
          style={{
            gridTemplateColumns: `repeat(${MAX_GRID}, 1fr)`,
            display: 'grid',
          }}
        >
          {Array.from({ length: MAX_GRID }).map((_, row) =>
            Array.from({ length: MAX_GRID }).map((_, col) => {
              const isSelected = row < selection.rows && col < selection.cols;
              return (
                <div
                  key={`${row}-${col}`}
                  className={`w-8 h-8 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-500'
                      : 'bg-white border border-gray-300 hover:bg-blue-100'
                  }`}
                  onMouseDown={() => handleMouseDown(row, col)}
                  onMouseEnter={() => handleMouseEnter(row, col)}
                  onClick={() => handleCellClick(row, col)}
                />
              );
            })
          )}
        </div>

        {/* 버튼 영역 */}
        <div className="flex justify-between items-center mt-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
            >
              {t('common.confirm')}
            </button>
          </div>
          {onAutoLayout && (
            <button
              type="button"
              onClick={handleAutoLayout}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              {t('grid.autoLayout')}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default GridSelector;
