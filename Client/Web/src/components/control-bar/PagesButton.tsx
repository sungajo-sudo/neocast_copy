import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

/**
 * 페이지 네비게이션 버튼
 * 왼쪽 패널에서 페이지 목록 표시
 */
export const PagesButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const activeLeftPanel = usePanelStore((state) => state.activeLeftPanel);
  const toggleLeftPanel = usePanelStore((state) => state.toggleLeftPanel);

  const icon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );

  return (
    <ControlBarButton
      icon={icon}
      label={t('controlBar.pages', 'Pages')}
      onClick={() => toggleLeftPanel('pages')}
      isActive={activeLeftPanel === 'pages'}
      tooltip={t('controlBar.pagesTip', 'View pages')}
      compact={compact}
    />
  );
};

export default PagesButton;
