import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { ControlBarButton } from './ControlBarButton';

/**
 * PenStream ON/OFF 버튼
 * 필기 입력 활성화/비활성화
 */
export const PenStreamButton: React.FC = () => {
  const { t } = useTranslation();
  const isPenStreamOn = usePanelStore((state) => state.isPenStreamOn);
  const togglePenStream = usePanelStore((state) => state.togglePenStream);

  const icon = isPenStreamOn ? (
    // 펜 활성화 아이콘
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ) : (
    // 펜 비활성화 아이콘
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
  );

  return (
    <ControlBarButton
      icon={icon}
      label={isPenStreamOn ? t('controlBar.penOn', 'Pen On') : t('controlBar.penOff', 'Pen Off')}
      onClick={togglePenStream}
      isActive={isPenStreamOn}
      variant={isPenStreamOn ? 'success' : 'default'}
      tooltip={isPenStreamOn ? t('controlBar.penOnTip', 'Drawing enabled') : t('controlBar.penOffTip', 'Drawing disabled')}
    />
  );
};

export default PenStreamButton;
