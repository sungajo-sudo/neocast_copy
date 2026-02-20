import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { useSessionStore } from '../../stores/session-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

/**
 * 참가자 패널 토글 버튼
 */
export const ParticipantsButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const activeRightPanel = usePanelStore((state) => state.activeRightPanel);
  const toggleRightPanel = usePanelStore((state) => state.toggleRightPanel);
  const session = useSessionStore((state) => state.session);

  const isActive = activeRightPanel === 'participants';
  const participantCount = session?.participants.filter(p => p.isOnline !== false).length ?? 0;

  const icon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  return (
    <ControlBarButton
      icon={icon}
      label={compact ? `${participantCount}` : `${t('controlBar.participants', 'Participants')} (${participantCount})`}
      onClick={() => toggleRightPanel('participants')}
      isActive={isActive}
      tooltip={t('controlBar.participantsTip', 'View participants')}
      badge={compact ? participantCount : undefined}
      compact={compact}
    />
  );
};

export default ParticipantsButton;
