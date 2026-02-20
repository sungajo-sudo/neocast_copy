import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

/**
 * 내 자료 버튼
 * 왼쪽 패널에서 내 자료 목록 표시
 */
export const MyPapersButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const activeLeftPanel = usePanelStore((state) => state.activeLeftPanel);
  const toggleLeftPanel = usePanelStore((state) => state.toggleLeftPanel);

  const icon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );

  return (
    <ControlBarButton
      icon={icon}
      label={t('controlBar.myMaterials', 'My Materials')}
      onClick={() => toggleLeftPanel('myPapers')}
      isActive={activeLeftPanel === 'myPapers'}
      tooltip={t('controlBar.myMaterialsTip', 'View my materials')}
      compact={compact}
    />
  );
};

export default MyPapersButton;
