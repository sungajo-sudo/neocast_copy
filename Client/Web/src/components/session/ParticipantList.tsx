import { useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import { useAuthStore } from '../../stores/auth-store';
import { useStrokeStore } from '../../stores/stroke-store';
import { ParticipantRole, formatPageAddress } from '../../types';
import { GridSelector } from './GridSelector';
import { sessionService } from '../../services/session-service';
import { useAlert } from '../../contexts/AlertContext';
import { mockPenConnected } from '../../utils/dev-mock';
import type { GridLayout } from '../../stores/session-store';

// 색상 팔레트 (ARGB 형식)
const COLOR_PALETTE = [
  { color: 0xffff0000, name: 'Red' },
  { color: 0xff0000ff, name: 'Blue' },
  { color: 0xff00aa00, name: 'Green' },
  { color: 0xffff8800, name: 'Orange' },
  { color: 0xff8800ff, name: 'Purple' },
  { color: 0xff000000, name: 'Black' },
];

interface ParticipantListProps {
  className?: string;
  onCopySessionCode?: () => void;
  onCopyInviteLink?: () => void;
}

/**
 * 참가자 목록 컴포넌트
 * - 호스트: 체크박스로 복수 참가자 선택 가능, 그리드 레이아웃 선택
 * - 게스트: 호스트와 자신만 클릭 가능
 */
export const ParticipantList: React.FC<ParticipantListProps> = ({
  className = '',
  onCopySessionCode,
  onCopyInviteLink
}) => {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const getUserColor = useSessionStore((state) => state.getUserColor);
  const selectedViewUserIds = useSessionStore((state) => state.selectedViewUserIds);
  const setSelectedViewUser = useSessionStore((state) => state.setSelectedViewUser);
  const setSelectedViewUsers = useSessionStore((state) => state.setSelectedViewUsers);
  const toggleSelectedViewUser = useSessionStore((state) => state.toggleSelectedViewUser);
  const canViewUser = useSessionStore((state) => state.canViewUser);
  const isHost = useSessionStore((state) => state.isHost);
  const setGridLayout = useSessionStore((state) => state.setGridLayout);
  const isGridLayoutAuto = useSessionStore((state) => state.isGridLayoutAuto);
  const setGridLayoutAuto = useSessionStore((state) => state.setGridLayoutAuto);
  const resetGridLayout = useSessionStore((state) => state.resetGridLayout);
  const updateParticipant = useSessionStore((state) => state.updateParticipant);
  const smartpenTargetUserId = useSessionStore((state) => state.smartpenTargetUserId);
  const setSmartpenTargetUserId = useSessionStore((state) => state.setSmartpenTargetUserId);
  const resetSmartpenTarget = useSessionStore((state) => state.resetSmartpenTarget);
  const guestInputSettings = useStrokeStore((state) => state.guestInputSettings);
  const setGuestInputColor = useStrokeStore((state) => state.setGuestInputColor);
  const participantCurrentPages = useStrokeStore((state) => state.participantCurrentPages);
  const { tokens } = useAuthStore();
  const { showConfirm } = useAlert();

  // 그리드 선택 팝업 상태
  const [isGridSelectorOpen, setIsGridSelectorOpen] = useState(false);
  // 초대/복사 팝업 상태
  const [isInviteMenuOpen, setIsInviteMenuOpen] = useState(false);
  // 참가자 메뉴 상태
  const [participantMenuUserId, setParticipantMenuUserId] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isKicking, setIsKicking] = useState(false);
  // 색상 팔레트 팝업 상태
  const [colorPaletteUserId, setColorPaletteUserId] = useState<string | null>(null);
  const colorPaletteRef = useRef<HTMLDivElement>(null);
  const colorButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // 체크박스 클릭 핸들러 (호스트 전용)
  const handleCheckboxChange = useCallback((userId: string) => {
    toggleSelectedViewUser(userId);
  }, [toggleSelectedViewUser]);

  // 참가자 클릭 핸들러 (이름 클릭 시 단일 선택)
  const handleParticipantClick = useCallback((userId: string) => {
    // 볼 수 있는 사용자인지 확인 (게스트의 경우)
    if (!isHost && !canViewUser(userId)) return;

    // 이름 클릭 시 해당 사용자만 단일 선택
    setSelectedViewUser(userId);
  }, [setSelectedViewUser, canViewUser, isHost]);

  // 그리드 레이아웃 선택 핸들러
  const handleGridSelect = useCallback((layout: GridLayout) => {
    setGridLayout(layout);
  }, [setGridLayout]);

  // 전체 보기 버튼 핸들러 (3단계 상태)
  // 일부 선택 → 전체 선택, 전체 선택 → 나만 선택
  const handleViewAllToggle = useCallback(() => {
    if (selectedViewUserIds.length === 0) {
      // 전체 선택 상태 → 나만 선택
      if (currentUserId) {
        setSelectedViewUser(currentUserId);
      }
    } else {
      // 일부 선택 상태 → 전체 선택
      setSelectedViewUsers([]);
    }
  }, [selectedViewUserIds, setSelectedViewUsers, setSelectedViewUser, currentUserId]);

  // 전체 보기 버튼 텍스트
  const viewAllButtonText = selectedViewUserIds.length === 0 ? t('canvas.owned') : t('canvas.notOwned');

  // 호스트 임명 핸들러
  const handlePromoteToHost = useCallback(async (userId: string) => {
    if (!session || !tokens?.accessToken) return;
    setIsPromoting(true);
    try {
      await sessionService.promoteToHost(tokens.accessToken, session.id, userId);
      // 로컬 상태 업데이트
      updateParticipant(userId, { role: ParticipantRole.Host });
    } catch (error) {
      console.error('Failed to promote to host:', error);
    } finally {
      setIsPromoting(false);
      setParticipantMenuUserId(null);
    }
  }, [session, tokens, updateParticipant]);

  // 호스트 강등 핸들러
  const handleDemoteToGuest = useCallback(async (userId: string) => {
    if (!session || !tokens?.accessToken) return;
    setIsPromoting(true);
    try {
      await sessionService.demoteToGuest(tokens.accessToken, session.id, userId);
      // 로컬 상태 업데이트
      updateParticipant(userId, { role: ParticipantRole.Guest });
    } catch (error) {
      console.error('Failed to demote to guest:', error);
    } finally {
      setIsPromoting(false);
      setParticipantMenuUserId(null);
    }
  }, [session, tokens, updateParticipant]);

  // 참가자 퇴출 핸들러
  const handleKickParticipant = useCallback(async (userId: string, userName: string) => {
    if (!session || !tokens?.accessToken) return;
    const confirmed = await showConfirm(t('participant.kickConfirm', { name: userName }));
    if (!confirmed) return;
    setIsKicking(true);
    try {
      await sessionService.kickParticipant(tokens.accessToken, session.id, userId);
    } catch (error) {
      console.error('Failed to kick participant:', error);
    } finally {
      setIsKicking(false);
      setParticipantMenuUserId(null);
    }
  }, [session, tokens, showConfirm, t]);

  // 참가자 메뉴 열기 핸들러
  const handleOpenParticipantMenu = useCallback((e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setParticipantMenuUserId(participantMenuUserId === userId ? null : userId);
  }, [participantMenuUserId]);

  // 스마트펜 타겟 설정 핸들러
  const handleSetSmartpenTarget = useCallback((userId: string) => {
    setSmartpenTargetUserId(userId);
    setParticipantMenuUserId(null);
  }, [setSmartpenTargetUserId]);

  // 스마트펜 타겟 토글 핸들러 (펜 아이콘 클릭)
  const handleToggleSmartpenTarget = useCallback((e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    // 이미 타겟이면 해제 (호스트 자신으로 되돌림)
    if (smartpenTargetUserId === userId) {
      resetSmartpenTarget();
    } else if (!smartpenTargetUserId && userId === currentUserId) {
      // 현재 호스트 자신이 타겟 상태에서 자신을 클릭하면 유지
      return;
    } else {
      // 새로운 타겟 설정
      setSmartpenTargetUserId(userId);
    }
  }, [smartpenTargetUserId, currentUserId, setSmartpenTargetUserId, resetSmartpenTarget]);

  // 색상 팔레트 열기 핸들러
  const handleOpenColorPalette = useCallback((e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setColorPaletteUserId(colorPaletteUserId === userId ? null : userId);
  }, [colorPaletteUserId]);

  // 색상 선택 핸들러
  const handleColorSelect = useCallback((color: number) => {
    setGuestInputColor(color);
    setColorPaletteUserId(null);
  }, [setGuestInputColor]);

  // 색상 팔레트 위치 조정 (화면 밖으로 나가지 않도록)
  useEffect(() => {
    if (colorPaletteUserId && colorPaletteRef.current) {
      const button = colorButtonRefs.current.get(colorPaletteUserId);
      if (button) {
        const buttonRect = button.getBoundingClientRect();
        const paletteRect = colorPaletteRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // 아래로 나가면 위로 표시
        if (buttonRect.bottom + paletteRect.height > viewportHeight) {
          colorPaletteRef.current.style.bottom = '100%';
          colorPaletteRef.current.style.top = 'auto';
          colorPaletteRef.current.style.marginBottom = '4px';
          colorPaletteRef.current.style.marginTop = '0';
        } else {
          colorPaletteRef.current.style.top = '100%';
          colorPaletteRef.current.style.bottom = 'auto';
          colorPaletteRef.current.style.marginTop = '4px';
          colorPaletteRef.current.style.marginBottom = '0';
        }

        // 오른쪽으로 나가면 왼쪽으로 정렬
        if (buttonRect.right + paletteRect.width - buttonRect.width > viewportWidth) {
          colorPaletteRef.current.style.right = '0';
          colorPaletteRef.current.style.left = 'auto';
        } else {
          colorPaletteRef.current.style.left = '0';
          colorPaletteRef.current.style.right = 'auto';
        }
      }
    }
  }, [colorPaletteUserId]);

  if (!session) {
    return null;
  }

  // 원래 호스트인지 확인 (호스트 강등 권한 확인용)
  const isOriginalHost = session.hostId === currentUserId;

  const participants = session.participants;
  const onlineParticipantCount = participants.filter(p => p.isOnline !== false).length;
  const isAllSelected = selectedViewUserIds.length === 0;

  return (
    <div className={`bg-transparent p-2 xl:p-4 flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between mb-1 xl:mb-2 flex-shrink-0 relative">
        <div className="flex-1"></div>
        <button
          type="button"
          ref={(el) => {
            if (el && isInviteMenuOpen) {
              const rect = el.getBoundingClientRect();
              const menu = document.getElementById('invite-menu-popup');
              if (menu) {
                menu.style.top = `${rect.bottom + 4}px`;
                menu.style.left = `${rect.right - 110}px`;
              }
            }
          }}
          onClick={() => setIsInviteMenuOpen(!isInviteMenuOpen)}
          className="flex items-center gap-1.5 xl:gap-2 p-1 -mr-1 hover:bg-gray-100 rounded cursor-pointer transition-colors"
        >
          <svg className="w-5 h-5 xl:w-6 xl:h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-base xl:text-lg font-semibold">{onlineParticipantCount}</span>
        </button>

        {isInviteMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsInviteMenuOpen(false)}
            ></div>
            <div
              id="invite-menu-popup"
              className="fixed w-[110px] bg-white rounded-md shadow-lg border border-gray-200 py-0.5 z-50 flex flex-col"
            >
              {onCopySessionCode && (
                <button
                  onClick={() => {
                    onCopySessionCode();
                    setIsInviteMenuOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t('participant.copyCode')}
                </button>
              )}
              {onCopyInviteLink && (
                <button
                  onClick={() => {
                    onCopyInviteLink();
                    setIsInviteMenuOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {t('participant.copyLink')}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 툴바 영역: 정렬, 그리드, 나만 보기, 스마트펜 리셋 */}
      <div className="mb-2 xl:mb-3 flex items-center justify-end gap-1 flex-shrink-0">
        {/* 스마트펜 타겟 리셋 버튼 (호스트, 타겟이 다른 사용자일 때만) */}
        {isHost && smartpenTargetUserId && smartpenTargetUserId !== currentUserId && (
          <div className="relative group">
            <button
              type="button"
              onClick={resetSmartpenTarget}
              className="p-1 xl:p-1.5 bg-red-100 hover:bg-red-200 rounded transition-colors"
              title={t('participant.resetSmartpenTarget')}
            >
              <svg className="w-3 h-3 xl:w-4 xl:h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden xl:block">
              {t('participant.resetSmartpenTarget')}
            </span>
          </div>
        )}

        {/* 그리드 레이아웃 컨트롤 (호스트, 복수 선택 시) */}
        {isHost && (selectedViewUserIds.length > 1 || isAllSelected) && (
          <>
            {/* 다시 정렬 */}
            <div className="relative group">
              <button
                type="button"
                onClick={resetGridLayout}
                className="p-1 xl:p-1.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                <svg className="w-3 h-3 xl:w-4 xl:h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden xl:block">
                {t('grid.reorder')}
              </span>
            </div>
            {/* 자동 (수동 모드일 때만) */}
            {!isGridLayoutAuto && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => setGridLayoutAuto(true)}
                  className="p-1 xl:p-1.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  <svg className="w-3 h-3 xl:w-4 xl:h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden xl:block">
                  {t('grid.autoLayout')}
                </span>
              </div>
            )}
            {/* 그리드 변경 */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => setIsGridSelectorOpen(true)}
                className="p-1 xl:p-1.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                <svg className="w-3 h-3 xl:w-4 xl:h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden xl:block">
                {t('grid.changeGrid')}
              </span>
            </div>
          </>
        )}

        {/* 나만 보기/전체 보기 토글 (호스트만) */}
        {isHost && (
          <div className="relative group">
            <button
              type="button"
              onClick={handleViewAllToggle}
              className={`p-1 xl:p-1.5 rounded transition-colors ${selectedViewUserIds.length === 0 ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {selectedViewUserIds.length === 0 ? (
                // 나만 보기 상태
                <svg className="w-3 h-3 xl:w-4 xl:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ) : (
                // 전체 보기 상태
                <svg className="w-3 h-3 xl:w-4 xl:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden xl:block">
              {viewAllButtonText}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {participants.map((participant, index) => {
          const isCurrentUser = participant.userId === currentUserId;
          const userColor = getUserColor(participant.userId);
          const isViewable = canViewUser(participant.userId);
          const isSelected = isAllSelected || selectedViewUserIds.includes(participant.userId);
          const isOffline = participant.isOnline === false;
          // 스마트펜 타겟 여부 (null이면 호스트 자신이 타겟)
          const isSmartpenTarget = smartpenTargetUserId
            ? smartpenTargetUserId === participant.userId
            : isCurrentUser && isHost;

          return (
            <div
              key={participant.userId}
              onClick={() => handleParticipantClick(participant.userId)}
              className={`flex items-center p-1.5 xl:p-2 rounded-md transition-all mx-[3px] mb-1 xl:mb-2 ${index === 0 ? 'mt-[3px]' : ''} ${isHost || isViewable ? 'cursor-pointer hover:shadow-md' : ''
                } ${!isViewable ? 'opacity-60' : ''
                } ${isOffline ? 'opacity-50' : ''
                } ${isCurrentUser ? 'bg-sky-100' : 'bg-gray-50'
                } ${isSmartpenTarget ? 'ring-2 ring-red-500' : isSelected && !isAllSelected ? 'ring-2 ring-blue-500' : ''
                }`}
            >
              {/* 호스트용 체크박스 / 게스트용 색상 표시 */}
              {isHost ? (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleCheckboxChange(participant.userId)}
                  className="w-3 h-3 xl:w-4 xl:h-4 mr-2 xl:mr-3 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : isCurrentUser ? (
                <svg
                  className={`w-3 h-3 xl:w-4 xl:h-4 mr-2 xl:mr-3 flex-shrink-0 text-blue-600 ${!isSelected ? 'opacity-40' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <polyline points="17 11 19 13 23 9" />
                </svg>
              ) : (
                <div
                  className={`w-3 h-3 xl:w-4 xl:h-4 rounded-full mr-2 xl:mr-3 flex-shrink-0 ${!isSelected ? 'opacity-40' : ''
                    }`}
                  style={{ backgroundColor: userColor }}
                />
              )}

              {/* 사용자 정보 */}
              <div className="flex-1 min-w-0 flex items-center">
                <span className={`font-medium text-xs xl:text-sm truncate ${!isSelected ? 'opacity-60' : ''}`}>
                  {participant.userName}
                </span>
                {participant.role === ParticipantRole.Host && (
                  <svg className="w-3 h-3 ml-1 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <title>{t('participant.host')}</title>
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                )}
                {/* 참가자 현재 페이지 */}
                {participant.role !== ParticipantRole.Host && participantCurrentPages.get(participant.userId) && (
                  <span className="ml-1 text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                    {formatPageAddress(participantCurrentPages.get(participant.userId)!)}
                  </span>
                )}
                {/* 펜 연결 DEV mock */}
                {participant.role !== ParticipantRole.Host && mockPenConnected(participant.userId) && (
                  <svg className="w-3 h-3 ml-0.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
                {/* 스마트펜 타겟 색상 팔레트 버튼 (호스트, 타겟이 자신이 아닐 때) */}
                {isSmartpenTarget && isHost && !isCurrentUser && (
                  <div className="relative ml-1 flex-shrink-0">
                    <button
                      ref={(el) => {
                        if (el) colorButtonRefs.current.set(participant.userId, el);
                      }}
                      onClick={(e) => handleOpenColorPalette(e, participant.userId)}
                      className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                      title={t('participant.smartpenColorSettings')}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: `#${(guestInputSettings.penColor & 0xffffff).toString(16).padStart(6, '0')}` }}>
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    {/* 색상 팔레트 팝업 */}
                    {colorPaletteUserId === participant.userId && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setColorPaletteUserId(null)}
                        />
                        <div
                          ref={colorPaletteRef}
                          className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2"
                          style={{ minWidth: '120px' }}
                        >
                          <div className="text-xs text-gray-500 mb-2">{t('participant.smartpenColor')}</div>
                          <div className="flex flex-wrap gap-1">
                            {COLOR_PALETTE.map((item) => (
                              <button
                                key={item.color}
                                onClick={() => handleColorSelect(item.color)}
                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${guestInputSettings.penColor === item.color ? 'border-gray-800 ring-2 ring-gray-300' : 'border-white'}`}
                                style={{ backgroundColor: `#${(item.color & 0xffffff).toString(16).padStart(6, '0')}` }}
                                title={item.name}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {isSelected && !isAllSelected && (
                  <span className="ml-1 xl:ml-2 text-[10px] xl:text-xs text-blue-600 font-semibold hidden xl:inline">{t('participant.viewing')}</span>
                )}
                {isSelected && !isAllSelected && (
                  <div className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-600 xl:hidden" title={t('participant.viewing')}></div>
                )}
                {participant.isOnline === false && (
                  <svg className="w-3 h-3 ml-1 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <title>{t('participant.offline')}</title>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                  </svg>
                )}
                {participant.isSpeaking && (
                  <svg className="w-3 h-3 ml-1 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <title>Speaking</title>
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* 스마트펜 아이콘 (모든 참가자에게 표시, 호스트만 클릭 가능) */}
              {isHost ? (
                <button
                  type="button"
                  onClick={(e) => handleToggleSmartpenTarget(e, participant.userId)}
                  className={`flex-shrink-0 ml-1.5 xl:ml-2 p-1 rounded transition-colors ${
                    isSmartpenTarget
                      ? 'text-red-500 hover:bg-red-100'
                      : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                  }`}
                  title={isSmartpenTarget ? t('participant.smartpenTarget') : t('participant.smartpenInput')}
                >
                  <svg className="w-3 h-3 xl:w-4 xl:h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              ) : (
                <div
                  className={`flex-shrink-0 ml-1.5 xl:ml-2 p-1 ${
                    isSmartpenTarget ? 'text-red-500' : 'text-gray-300'
                  }`}
                  title={isSmartpenTarget ? t('participant.smartpenTarget') : t('participant.smartpenInput')}
                >
                  <svg className="w-3 h-3 xl:w-4 xl:h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </div>
              )}

              {/* 음소거 상태 */}
              {participant.isMuted && (
                <div className="flex-shrink-0 ml-1.5 xl:ml-2">
                  <svg
                    className="w-3 h-3 xl:w-4 xl:h-4 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              {/* 호스트용 참가자 메뉴 ([...] 버튼) - 모든 참가자에게 표시 */}
              {isHost && (
                <div className="relative flex-shrink-0 ml-1.5 xl:ml-2">
                  <button
                    type="button"
                    onClick={(e) => handleOpenParticipantMenu(e, participant.userId)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <svg className="w-3 h-3 xl:w-4 xl:h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  {/* 참가자 메뉴 팝업 */}
                  {participantMenuUserId === participant.userId && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setParticipantMenuUserId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                        {/* 스마트펜 입력 대상 설정 */}
                        <button
                          onClick={() => handleSetSmartpenTarget(participant.userId)}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 flex items-center gap-2 ${isSmartpenTarget ? 'text-red-600 bg-red-50' : 'text-gray-700'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          {t('participant.smartpenInput')}
                          {isSmartpenTarget && (
                            <svg className="w-3 h-3 ml-auto text-red-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        {/* 호스트/게스트 전환 (자신 제외) */}
                        {!isCurrentUser && (
                          <>
                            <div className="border-t border-gray-100 my-1" />
                            {participant.role === ParticipantRole.Guest ? (
                              <button
                                onClick={() => handlePromoteToHost(participant.userId)}
                                disabled={isPromoting}
                                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                                {isPromoting ? t('common.processing') : t('participant.promoteToHost')}
                              </button>
                            ) : (
                              isOriginalHost && participant.userId !== session.hostId && (
                                <button
                                  onClick={() => handleDemoteToGuest(participant.userId)}
                                  disabled={isPromoting}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                  {isPromoting ? t('common.processing') : t('participant.demoteToGuest')}
                                </button>
                              )
                            )}
                            {/* 참가자 퇴출 (자신과 원래 호스트 제외) */}
                            {participant.userId !== session.hostId && (
                              <>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                  onClick={() => handleKickParticipant(participant.userId, participant.userName)}
                                  disabled={isKicking}
                                  className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                  </svg>
                                  {isKicking ? t('common.processing') : t('participant.kick')}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 하단 버튼 영역 제거됨 (상단 메뉴로 이동) */}

      {/* 동기화 진행 상태 */}
      <SyncProgress />

      {/* 그리드 선택 팝업 */}
      <GridSelector
        isOpen={isGridSelectorOpen}
        onClose={() => setIsGridSelectorOpen(false)}
        onSelect={handleGridSelect}
      />
    </div>
  );
};

/**
 * 동기화 진행 상태 표시
 */
const SyncProgress: React.FC = () => {
  const isSyncing = useSessionStore((state) => state.isSyncing);
  const syncProgress = useSessionStore((state) => state.syncProgress);
  const totalStrokes = useSessionStore((state) => state.totalStrokes);

  if (!isSyncing) return null;

  const percentage = totalStrokes > 0 ? (syncProgress / totalStrokes) * 100 : 0;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">Syncing history...</span>
        <span className="text-sm text-gray-600">
          {syncProgress} / {totalStrokes}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ParticipantList;
