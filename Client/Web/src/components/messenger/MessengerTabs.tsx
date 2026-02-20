import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MessengerTab } from '../../stores/messenger-store';
import { useFriendStore } from '../../stores/friend-store';
import { useMessengerStore } from '../../stores/messenger-store';

interface MessengerTabsProps {
  activeTab: MessengerTab;
  onTabChange: (tab: MessengerTab) => void;
}

/**
 * 메신저 탭 (세로 배치)
 * - 친구 탭
 * - 메시지 탭
 */
export const MessengerTabs: React.FC<MessengerTabsProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();
  const receivedRequestCount = useFriendStore((state) => state.receivedRequests.length);
  const totalUnreadCount = useMessengerStore((state) => state.totalUnreadCount);

  return (
    <div className="flex flex-col w-14 border-r border-gray-200 bg-gray-50 py-2">
      {/* 친구 탭 */}
      <button
        type="button"
        onClick={() => onTabChange('friends')}
        className={`relative flex flex-col items-center justify-center py-3 px-2 transition-colors ${
          activeTab === 'friends'
            ? 'bg-blue-100 text-blue-600 border-r-2 border-blue-500'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
        title={t('messenger.tabs.friends', 'Friends')}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span className="text-[10px] mt-1 font-medium">
          {t('messenger.tabs.friends', 'Friends')}
        </span>
        {/* 친구 요청 배지 */}
        {receivedRequestCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {receivedRequestCount > 9 ? '9+' : receivedRequestCount}
          </span>
        )}
      </button>

      {/* 메시지 탭 */}
      <button
        type="button"
        onClick={() => onTabChange('messages')}
        className={`relative flex flex-col items-center justify-center py-3 px-2 transition-colors ${
          activeTab === 'messages'
            ? 'bg-blue-100 text-blue-600 border-r-2 border-blue-500'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
        title={t('messenger.tabs.messages', 'Messages')}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="text-[10px] mt-1 font-medium">
          {t('messenger.tabs.messages', 'Messages')}
        </span>
        {/* 읽지 않은 메시지 배지 */}
        {totalUnreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default MessengerTabs;
