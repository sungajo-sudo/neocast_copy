import React from 'react';
import { useTranslation } from 'react-i18next';
import { PanelHeader } from './PanelHeader';
import { usePanelStore } from '../../stores/panel-store';
import { ParticipantList } from '../session/ParticipantList';

interface ParticipantsPanelProps {
  onCopySessionCode?: () => void;
  onCopyInviteLink?: () => void;
}

/**
 * 참가자 패널 컴포넌트
 * 기존 ParticipantList를 패널 형태로 래핑
 */
export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  onCopySessionCode,
  onCopyInviteLink,
}) => {
  const { t } = useTranslation();
  const setActiveRightPanel = usePanelStore((state) => state.setActiveRightPanel);

  return (
    <div className="flex flex-col h-full bg-white/60 backdrop-blur-md">
      <PanelHeader
        title={t('participant.title', 'Participants')}
        onClose={() => setActiveRightPanel(null)}
      />

      {/* ParticipantList 컴포넌트 */}
      <div className="flex-1 overflow-hidden">
        <ParticipantList
          className="h-full"
          onCopySessionCode={onCopySessionCode}
          onCopyInviteLink={onCopyInviteLink}
        />
      </div>
    </div>
  );
};

export default ParticipantsPanel;
