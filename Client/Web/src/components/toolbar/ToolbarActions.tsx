import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useStrokeStore } from '../../stores/stroke-store';
import { strokeService } from '../../services/stroke-service';
import { useAlert } from '../../contexts/AlertContext';

/**
 * Undo/Redo/Clear 버튼 (Top bar용)
 */
export const ToolbarActions: React.FC = () => {
  const { t } = useTranslation();
  const currentPageAddress = useStrokeStore((state) => state.currentPageAddress);
  const { showConfirm } = useAlert();

  const handleUndo = useCallback(() => {
    strokeService.undo();
  }, []);

  const handleRedo = useCallback(() => {
    strokeService.redo();
  }, []);

  const handleClear = useCallback(async () => {
    if (await showConfirm(t('canvas.clearConfirm'))) {
      strokeService.clearPageByAddress(currentPageAddress);
    }
  }, [currentPageAddress, showConfirm, t]);

  return (
    <div className="flex items-center space-x-1">
      <button
        onClick={handleUndo}
        className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-full transition-colors border border-gray-200"
        title={t('canvas.undo')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      <button
        onClick={handleRedo}
        className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-full transition-colors border border-gray-200"
        title={t('canvas.redo')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
        </svg>
      </button>
      <button
        onClick={handleClear}
        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-100 bg-gray-100 rounded-full transition-colors border border-gray-200"
        title={t('canvas.clearPage')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
};

export default ToolbarActions;
