import React from 'react';

interface PanelHeaderProps {
  title: string;
  onClose: () => void;
  actions?: React.ReactNode;
}

/**
 * 패널 헤더 컴포넌트
 * 제목 + 닫기 버튼 + 선택적 액션 버튼들
 */
export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  onClose,
  actions,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50 bg-white/50">
      <h3 className="font-semibold text-gray-800">{title}</h3>
      <div className="flex items-center gap-2">
        {actions}
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-gray-200/50 rounded transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default PanelHeader;
