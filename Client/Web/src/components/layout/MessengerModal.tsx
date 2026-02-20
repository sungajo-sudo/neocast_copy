import React, { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { useMessengerStore, type MessengerTab, type MessageThread } from '../../stores/messenger-store';
import { useFriendStore, type Friend } from '../../stores/friend-store';
import { messengerService } from '../../services/messenger-service';
import { useAuthStore } from '../../stores/auth-store';
import { MessengerTabs } from '../messenger/MessengerTabs';
import { FriendList } from '../messenger/FriendList';
import { MessageThreadList } from '../messenger/MessageThreadList';
import { ChatView } from '../messenger/ChatView';

/**
 * 메신저 모달 - 친구 관리 및 1:1 메시지 기능
 */
export const MessengerModal: React.FC = () => {
  const { t } = useTranslation();
  const isMessengerOpen = usePanelStore((state) => state.isMessengerOpen);
  const setMessengerOpen = usePanelStore((state) => state.setMessengerOpen);
  const clearUnreadMessenger = usePanelStore((state) => state.clearUnreadMessenger);

  // 인증 정보
  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.id ?? '';

  // 메신저 스토어
  const activeTab = useMessengerStore((state) => state.activeTab);
  const setActiveTab = useMessengerStore((state) => state.setActiveTab);
  const selectedThreadId = useMessengerStore((state) => state.selectedThreadId);
  const setSelectedThreadId = useMessengerStore((state) => state.setSelectedThreadId);
  const selectedFriendId = useMessengerStore((state) => state.selectedFriendId);
  const setSelectedFriendId = useMessengerStore((state) => state.setSelectedFriendId);
  const selectFriendAndSwitchToMessages = useMessengerStore((state) => state.selectFriendAndSwitchToMessages);
  const threads = useMessengerStore((state) => state.threads);

  // 친구 스토어
  const isConnected = useFriendStore((state) => state.isConnected);
  const friends = useFriendStore((state) => state.friends);

  // 선택된 스레드 정보
  const selectedThread = selectedThreadId ? threads.find((t) => t.id === selectedThreadId) : null;

  // 선택된 친구 정보 (친구 목록에서 선택한 경우)
  const selectedFriend = selectedFriendId ? friends.find((f) => f.friendId === selectedFriendId) : null;

  // 메신저 서비스 연결 및 읽지 않은 메시지 초기화
  useEffect(() => {
    if (isMessengerOpen && currentUserId) {
      messengerService.connect();
      clearUnreadMessenger();
      return () => {
        // 모달이 닫혀도 연결은 유지 (백그라운드 알림을 위해)
      };
    }
  }, [isMessengerOpen, currentUserId, clearUnreadMessenger]);

  // 모달 닫기
  const handleClose = useCallback(() => {
    setMessengerOpen(false);
  }, [setMessengerOpen]);

  // 탭 변경
  const handleTabChange = useCallback((tab: MessengerTab) => {
    setActiveTab(tab);
    // 탭 변경 시 선택 초기화
    if (tab === 'friends') {
      setSelectedThreadId(null);
    } else {
      setSelectedFriendId(null);
    }
  }, [setActiveTab, setSelectedThreadId, setSelectedFriendId]);

  // 친구 선택 (대화 시작)
  const handleSelectFriend = useCallback(async (friend: Friend) => {
    // 기존 스레드가 있는지 확인
    const existingThread = threads.find((t) => t.participantId === friend.friendId);

    if (existingThread) {
      selectFriendAndSwitchToMessages(friend.friendId, existingThread.id);
    } else {
      // 새 스레드 생성
      try {
        const threadId = await messengerService.startConversation(friend.friendId);
        await messengerService.loadThreads(); // 스레드 목록 새로고침
        selectFriendAndSwitchToMessages(friend.friendId, threadId);
      } catch (error) {
        console.error('Failed to start conversation:', error);
        // 스레드 없이 친구만 선택
        selectFriendAndSwitchToMessages(friend.friendId);
      }
    }
  }, [threads, selectFriendAndSwitchToMessages]);

  // 스레드 선택
  const handleSelectThread = useCallback((thread: MessageThread) => {
    setSelectedThreadId(thread.id);
    // DM 스레드인 경우에만 친구 ID 설정
    if (thread.type === 'dm') {
      setSelectedFriendId(thread.participantId);
    } else {
      setSelectedFriendId(null);
    }
  }, [setSelectedThreadId, setSelectedFriendId]);

  // 대화창 뒤로가기 (모바일)
  const handleBackFromChat = useCallback(() => {
    setSelectedThreadId(null);
    setSelectedFriendId(null);
  }, [setSelectedThreadId, setSelectedFriendId]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMessengerOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMessengerOpen, handleClose]);

  if (!isMessengerOpen) {
    return null;
  }

  // 현재 보여줄 대화 상대 정보
  const isSessionChat = selectedThread?.type === 'session';
  const chatParticipantName = isSessionChat
    ? selectedThread?.sessionCode
      ? `[${selectedThread.sessionCode}]`
      : t('messenger.sessionChat', 'Session Chat')
    : selectedThread?.participantName ?? selectedFriend?.name ?? '';
  const chatThreadId = selectedThreadId ?? '';
  const showChat = !!chatThreadId && (!!chatParticipantName || isSessionChat);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 h-[75vh] flex flex-col animate-in fade-in zoom-in duration-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">
              {t('messenger.title', 'Messenger')}
            </h2>
            {!isConnected && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                {t('messenger.offline', 'Offline')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 탭 버튼 (세로) */}
          <MessengerTabs activeTab={activeTab} onTabChange={handleTabChange} />

          {/* 리스트 패널 */}
          <div className="w-64 border-r border-gray-200 overflow-hidden flex-shrink-0">
            {activeTab === 'friends' ? (
              <FriendList
                onSelectFriend={handleSelectFriend}
                selectedFriendId={selectedFriendId}
              />
            ) : (
              <MessageThreadList
                onSelectThread={handleSelectThread}
                selectedThreadId={selectedThreadId}
              />
            )}
          </div>

          {/* 대화창 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {showChat ? (
              <ChatView
                threadId={chatThreadId}
                participantName={chatParticipantName}
                currentUserId={currentUserId}
                onBack={handleBackFromChat}
                isSessionChat={isSessionChat}
                sessionInfo={
                  isSessionChat && selectedThread
                    ? {
                        sessionCode: selectedThread.sessionCode,
                        hostName: selectedThread.hostName,
                        participantNames: selectedThread.participantNames,
                      }
                    : undefined
                }
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-gray-600">
                    {activeTab === 'friends'
                      ? t('messenger.selectFriend', 'Select a friend')
                      : t('messenger.selectThread', 'Select a conversation')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {activeTab === 'friends'
                      ? t('messenger.selectFriendHint', 'to start a conversation')
                      : t('messenger.selectThreadHint', 'to continue messaging')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessengerModal;
