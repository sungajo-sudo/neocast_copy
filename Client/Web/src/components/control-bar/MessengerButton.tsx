import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

/**
 * 메신저 팝업 버튼
 */
export const MessengerButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const isMessengerOpen = usePanelStore((state) => state.isMessengerOpen);
  const toggleMessenger = usePanelStore((state) => state.toggleMessenger);

  const icon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );

  return (
    <ControlBarButton
      icon={icon}
      label={t('controlBar.messenger', 'Messenger')}
      onClick={toggleMessenger}
      isActive={isMessengerOpen}
      tooltip={t('controlBar.messengerTip', 'Open messenger')}
      compact={compact}
    />
  );
};

export default MessengerButton;
