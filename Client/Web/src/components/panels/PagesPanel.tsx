import React from 'react';
import { useTranslation } from 'react-i18next';
import { PanelHeader } from './PanelHeader';
import { usePanelStore } from '../../stores/panel-store';
import { PageNavigation } from '../toolbar/PageNavigation';

/**
 * 페이지 네비게이션 패널 컴포넌트
 * 기존 PageNavigation을 패널 형태로 래핑
 */
export const PagesPanel: React.FC = () => {
  const { t } = useTranslation();
  const setActiveRightPanel = usePanelStore((state) => state.setActiveRightPanel);

  return (
    <div className="flex flex-col h-full bg-white/60 backdrop-blur-md">
      <PanelHeader
        title={t('pages.title', 'Pages')}
        onClose={() => setActiveRightPanel(null)}
      />

      {/* PageNavigation 컴포넌트 */}
      <div className="flex-1 overflow-hidden">
        <PageNavigation className="h-full bg-transparent" />
      </div>
    </div>
  );
};

export default PagesPanel;
