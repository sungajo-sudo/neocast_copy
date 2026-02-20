import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMessengerStore, type MessageThread } from '../../stores/messenger-store';
import { messengerService } from '../../services/messenger-service';

interface MessageThreadListProps {
  onSelectThread: (thread: MessageThread) => void;
  selectedThreadId: string | null;
}

/**
 * 메시지 대화 목록 컴포넌트
 */
export const MessageThreadList: React.FC<MessageThreadListProps> = ({
  onSelectThread,
  selectedThreadId,
}) => {
  const { t } = useTranslation();
  const threads = useMessengerStore((state) => state.threads);
  const isLoadingThreads = useMessengerStore((state) => state.isLoadingThreads);

  // 스레드 목록 로드
  useEffect(() => {
    messengerService.loadThreads().catch(console.error);
  }, []);

  const formatTime = (dateString: string | null): string => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return t('messenger.time.yesterday', 'Yesterday');
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isLoadingThreads && threads.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <span className="text-sm">{t('common.loading', 'Loading...')}</span>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4">
        <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p className="text-sm">{t('messenger.noMessages', 'No messages yet')}</p>
        <p className="text-xs text-gray-400 mt-1 text-center">
          {t('messenger.startMessageHint', 'Select a friend to start a conversation')}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">
          {t('messenger.tabs.messages', 'Messages')}
        </h3>
      </div>

      {/* 대화 목록 */}
      <div className="flex-1 overflow-y-auto">
        {threads.map((thread) => {
          const isSelected = selectedThreadId === thread.id;
          const hasUnread = thread.unreadCount > 0;
          const isSessionChat = thread.type === 'session';

          // 세션 채팅의 경우 표시 이름 생성
          const displayName = isSessionChat
            ? thread.sessionCode
              ? `[${thread.sessionCode}]`
              : t('messenger.sessionChat', 'Session Chat')
            : thread.participantName;

          // 세션 채팅의 경우 참가자 이름 목록 생성
          const participantInfo = isSessionChat && thread.participantNames
            ? thread.participantNames.slice(0, 3).join(', ') +
              (thread.participantNames.length > 3
                ? ` +${thread.participantNames.length - 3}`
                : '')
            : null;

          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelectThread(thread)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-b border-gray-100 ${
                isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              {/* 아바타 */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${
                  isSessionChat
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {isSessionChat ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                ) : (
                  thread.participantName.charAt(0).toUpperCase()
                )}
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-sm truncate ${hasUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {displayName}
                    </span>
                    {isSessionChat && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-600 rounded font-medium flex-shrink-0">
                        {t('messenger.session', 'Session')}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatTime(thread.lastMessageAt)}
                  </span>
                </div>
                {/* 세션 채팅: 참가자 목록 표시 */}
                {isSessionChat && participantInfo && (
                  <div className="text-[11px] text-gray-400 truncate mt-0.5">
                    {participantInfo}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className={`text-xs truncate ${hasUnread ? 'font-medium text-gray-700' : 'text-gray-500'}`}>
                    {thread.lastMessage || t('messenger.noMessageYet', 'No messages yet')}
                  </span>
                  {hasUnread && (
                    <span className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                      {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MessageThreadList;
