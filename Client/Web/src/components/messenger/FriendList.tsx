import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFriendStore, type Friend, type FriendRequest, type PresenceStatus } from '../../stores/friend-store';
import { friendService } from '../../services/friend-service';

interface FriendListProps {
  onSelectFriend: (friend: Friend) => void;
  selectedFriendId: string | null;
}

/**
 * 친구 목록 컴포넌트
 * - 온라인 상태 표시
 * - 친구 요청 알림
 * - 친구 추가 기능
 */
export const FriendList: React.FC<FriendListProps> = ({ onSelectFriend, selectedFriendId }) => {
  const { t } = useTranslation();
  const friends = useFriendStore((state) => state.friends);
  const receivedRequests = useFriendStore((state) => state.receivedRequests);
  const sentRequests = useFriendStore((state) => state.sentRequests);
  const isLoading = useFriendStore((state) => state.isLoading);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<{
    id: string;
    email: string;
    name: string;
    isFriend: boolean;
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    friendService.loadAll().catch(console.error);
  }, []);

  // [+] 버튼 클릭 시 입력창에 포커스
  useEffect(() => {
    if (showAddFriend && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [showAddFriend]);

  // 보낸 요청 중 펜딩 상태만 필터
  const pendingRequests = sentRequests.filter((r) => r.status === 'PENDING');

  // 온라인/오프라인 친구 분리
  const onlineFriends = friends.filter((f) => f.status !== 'offline');
  const offlineFriends = friends.filter((f) => f.status === 'offline');

  // 사용자 검색
  const handleSearch = async () => {
    if (!searchEmail.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const result = await friendService.searchUserByEmail(searchEmail.trim());
      if (result) {
        setSearchResult(result);
      } else {
        setSearchError(t('messenger.friends.userNotFound', 'User not found'));
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // 친구 요청 보내기
  const handleSendRequest = async () => {
    if (!searchResult) return;

    setIsSendingRequest(true);
    try {
      await friendService.sendFriendRequest(searchResult.email);
      setSearchResult(null);
      setSearchEmail('');
      setShowAddFriend(false);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Failed to send request');
    } finally {
      setIsSendingRequest(false);
    }
  };

  // 친구 요청 수락
  const handleAcceptRequest = async (requestId: string) => {
    try {
      await friendService.acceptRequest(requestId);
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };

  // 친구 요청 거절
  const handleRejectRequest = async (requestId: string) => {
    try {
      await friendService.rejectRequest(requestId);
    } catch (error) {
      console.error('Failed to reject request:', error);
    }
  };

  const getStatusColor = (status: PresenceStatus): string => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'busy':
        return 'bg-red-500';
      case 'away':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: PresenceStatus): string => {
    switch (status) {
      case 'online':
        return t('messenger.friends.online', 'Online');
      case 'busy':
        return t('messenger.friends.busy', 'Busy');
      case 'away':
        return t('messenger.friends.away', 'Away');
      default:
        return t('messenger.friends.offline', 'Offline');
    }
  };

  const renderFriendItem = (friend: Friend) => {
    const isSelected = selectedFriendId === friend.friendId;

    return (
      <button
        key={friend.friendId}
        type="button"
        onClick={() => onSelectFriend(friend)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
          isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
        }`}
      >
        {/* 아바타 with 상태 표시 */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
            {friend.name.charAt(0).toUpperCase()}
          </div>
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(friend.status)}`}
            title={getStatusLabel(friend.status)}
          />
        </div>
        {/* 이름 */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{friend.name}</div>
          <div className="text-xs text-gray-500 truncate">{friend.email}</div>
        </div>
      </button>
    );
  };

  // 보낸 요청(펜딩) 아이템 렌더링
  const renderPendingRequestItem = (request: FriendRequest) => {
    return (
      <div
        key={request.id}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left bg-yellow-50/50 text-gray-600"
      >
        {/* 아바타 with 펜딩 표시 */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-semibold">
            {request.toUserName.charAt(0).toUpperCase()}
          </div>
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-yellow-400"
            title={t('messenger.friends.pending', 'Pending')}
          />
        </div>
        {/* 이름 */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{request.toUserName}</div>
          <div className="text-xs text-yellow-600 truncate">{t('messenger.friends.pendingRequest', 'Request sent')}</div>
        </div>
        {/* 취소 버튼 */}
        <button
          type="button"
          onClick={() => friendService.cancelSentRequest(request.id).catch(console.error)}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title={t('messenger.friends.cancelRequest', 'Cancel request')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  };

  if (isLoading && friends.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <span className="text-sm">{t('common.loading', 'Loading...')}</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 헤더 & 친구 추가 버튼 */}
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">
            {t('messenger.tabs.friends', 'Friends')}
          </h3>
          <button
            type="button"
            onClick={() => setShowAddFriend(!showAddFriend)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title={t('messenger.friends.addFriend', 'Add Friend')}
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>

        {/* 친구 추가 폼 */}
        {showAddFriend && (
          <div className="mt-2 p-2 bg-gray-50 rounded-lg">
            <div className="flex gap-1.5 items-center">
              <input
                ref={emailInputRef}
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isSearching && searchEmail.trim() && handleSearch()}
                placeholder={t('messenger.friends.searchPlaceholder', 'Search by email...')}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !searchEmail.trim()}
                className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex-shrink-0"
                title={t('common.search', 'Search')}
              >
                {isSearching ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>

            {/* 검색 결과 */}
            {searchResult && (
              <div className="mt-2 p-1.5 bg-white rounded border border-gray-200 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-semibold flex-shrink-0">
                  {searchResult.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{searchResult.name}</div>
                  <div className="text-[10px] text-gray-500 truncate">{searchResult.email}</div>
                </div>
                {searchResult.isFriend ? (
                  <span className="text-[10px] text-gray-500 flex-shrink-0">
                    {t('messenger.friends.alreadyFriends', 'Already friends')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendRequest}
                    disabled={isSendingRequest}
                    className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex-shrink-0"
                    title={t('messenger.friends.addFriend', 'Add Friend')}
                  >
                    {isSendingRequest ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* 에러 메시지 */}
            {searchError && <p className="mt-1.5 text-[10px] text-red-500">{searchError}</p>}
          </div>
        )}
      </div>

      {/* 친구 요청 목록 */}
      {receivedRequests.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">
            {t('messenger.requests.title', 'Friend Requests')} ({receivedRequests.length})
          </h4>
          <div className="space-y-2">
            {receivedRequests.map((request) => (
              <div key={request.id} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 text-sm font-semibold">
                  {request.fromUserName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{request.fromUserName}</div>
                  {request.message && (
                    <div className="text-xs text-gray-500 truncate">{request.message}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleAcceptRequest(request.id)}
                    className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                    title={t('messenger.requests.accept', 'Accept')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectRequest(request.id)}
                    className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                    title={t('messenger.requests.reject', 'Reject')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 친구 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {friends.length === 0 && pendingRequests.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="text-sm">{t('messenger.friends.noFriends', 'No friends yet')}</p>
            <p className="text-xs text-gray-400 mt-1">
              {t('messenger.friends.addFriendHint', 'Add friends to start messaging')}
            </p>
          </div>
        ) : (
          <>
            {/* 보낸 요청 (펜딩) */}
            {pendingRequests.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-yellow-600 px-1 mb-1">
                  {t('messenger.friends.pending', 'Pending')} ({pendingRequests.length})
                </h4>
                <div className="space-y-1">{pendingRequests.map(renderPendingRequestItem)}</div>
              </div>
            )}

            {/* 온라인 친구 */}
            {onlineFriends.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-green-600 px-1 mb-1">
                  {t('messenger.friends.online', 'Online')} ({onlineFriends.length})
                </h4>
                <div className="space-y-1">{onlineFriends.map(renderFriendItem)}</div>
              </div>
            )}

            {/* 오프라인 친구 */}
            {offlineFriends.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 px-1 mb-1">
                  {t('messenger.friends.offline', 'Offline')} ({offlineFriends.length})
                </h4>
                <div className="space-y-1">{offlineFriends.map(renderFriendItem)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FriendList;
