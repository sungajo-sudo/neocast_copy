import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

/**
 * 채팅 패널 토글 버튼
 */
export const ChatButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const activeRightPanel = usePanelStore((state) => state.activeRightPanel);
  const toggleRightPanel = usePanelStore((state) => state.toggleRightPanel);
  const unreadChatCount = usePanelStore((state) => state.unreadChatCount);

  const isActive = activeRightPanel === 'chat';

  const icon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );

  return (
    <ControlBarButton
      icon={icon}
      label={t('controlBar.chat', 'Chat')}
      onClick={() => toggleRightPanel('chat')}
      isActive={isActive}
      badge={unreadChatCount}
      tooltip={t('controlBar.chatTip', 'Open chat')}
      compact={compact}
    />
  );
};

export default ChatButton;
