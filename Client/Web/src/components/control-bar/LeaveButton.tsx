import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { useSessionStore } from '../../stores/session-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

/**
 * 세션 나가기 버튼
 */
export const LeaveButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const setLeaveConfirmOpen = usePanelStore((state) => state.setLeaveConfirmOpen);
  const isHost = useSessionStore((state) => state.isHost);

  const icon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );

  const label = isHost
    ? t('controlBar.endSession', 'End')
    : t('controlBar.leave', 'Leave');

  return (
    <ControlBarButton
      icon={icon}
      label={label}
      onClick={() => setLeaveConfirmOpen(true)}
      variant="danger"
      tooltip={isHost ? t('controlBar.endSessionTip', 'End session for all') : t('controlBar.leaveTip', 'Leave session')}
      compact={compact}
    />
  );
};

export default LeaveButton;
