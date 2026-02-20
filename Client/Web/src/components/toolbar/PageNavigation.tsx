import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStrokeStore } from '../../stores/stroke-store';
import { usePageStore, type PageInfo } from '../../stores/page-store';
import { useSessionStore } from '../../stores/session-store';
import { strokeService } from '../../services/stroke-service';
import { isMousePage, isSamePageAddress, formatPageAddress } from '../../types';
import type { NcodePageAddress } from '../../types';

// 페이지 합집합 아이템 (여러 사용자가 같은 페이지를 가질 수 있음)
interface UnionPageItem {
  address: NcodePageAddress;
  owners: string[]; // 해당 페이지를 소유한 사용자 ID 목록
  createdAt: number; // 가장 먼저 생성된 시간
}

interface PageNavigationProps {
  className?: string;
}

/**
 * 페이지 네비게이션
 * - 선택된 사용자의 페이지만 세로 리스트로 표시
 * - Lock이 체크되어 있으면: 수동으로 페이지를 선택해야 이동
 * - Lock이 해제되어 있으면: 받은 필기의 페이지에 따라 자동 이동
 * - [+] 버튼으로 새 마우스 페이지 추가
 */
export const PageNavigation: React.FC<PageNavigationProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const currentPageAddress = useStrokeStore((state) => state.currentPageAddress);
  const pageNavigationLocked = useStrokeStore((state) => state.pageNavigationLocked);
  const togglePageNavigationLock = useStrokeStore((state) => state.togglePageNavigationLock);
  const setCurrentPage = useStrokeStore((state) => state.setCurrentPage);

  const pages = usePageStore((state) => state.pages);
  const addMousePage = usePageStore((state) => state.addMousePage);
  const setCurrentPageInStore = usePageStore((state) => state.setCurrentPage);
  const initializeForUser = usePageStore((state) => state.initializeForUser);

  const currentUserId = useSessionStore((state) => state.currentUserId);
  const selectedViewUserId = useSessionStore((state) => state.selectedViewUserId);
  const selectedViewUserIds = useSessionStore((state) => state.selectedViewUserIds);
  const session = useSessionStore((state) => state.session);
  const getUserColor = useSessionStore((state) => state.getUserColor);
  const getParticipant = useSessionStore((state) => state.getParticipant);

  // 현재 보고 있는 사용자 ID (선택된 사용자 또는 현재 사용자)
  const viewingUserId = selectedViewUserId ?? currentUserId;

  // 복수 사용자 모드인지 확인
  const isMultiUserMode = selectedViewUserIds.length === 0 || selectedViewUserIds.length > 1;

  // 복수 사용자 모드에서 대상 사용자 목록
  const targetUserIds = useMemo(() => {
    if (selectedViewUserIds.length === 0) {
      // 전체 보기: 모든 참가자
      return session?.participants.map((p) => p.userId) ?? [];
    }
    if (selectedViewUserIds.length > 1) {
      // 복수 선택: 선택된 사용자들
      return selectedViewUserIds;
    }
    // 단일 선택
    return viewingUserId ? [viewingUserId] : [];
  }, [selectedViewUserIds, session, viewingUserId]);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    page: PageInfo;
  } | null>(null);

  // 현재 선택된 페이지 버튼 ref (자동 스크롤용)
  const selectedPageRef = useRef<HTMLButtonElement>(null);

  // 사용자가 변경될 때 해당 사용자의 초기 페이지 생성
  useEffect(() => {
    if (viewingUserId) {
      const createdAddress = initializeForUser(viewingUserId);
      // 자신의 초기 페이지가 생성된 경우 서버로 PAGE_ADD 전송
      // 다른 참가자들이 이 페이지를 볼 수 있도록 함
      if (createdAddress && viewingUserId === currentUserId && currentUserId) {
        strokeService.addPage(currentUserId, createdAddress);
        console.log('[PageNavigation] Sent PAGE_ADD for initial page:', formatPageAddress(createdAddress));
      }
    }
  }, [viewingUserId, currentUserId, initializeForUser]);

  // 현재 페이지가 변경되면 자동으로 스크롤
  useEffect(() => {
    if (selectedPageRef.current) {
      selectedPageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentPageAddress]);

  // 해당 사용자(들)의 페이지 목록 (pages 변경 시 재계산)
  // 복수 사용자 모드에서는 페이지 합집합을 생성
  const unionPages = useMemo((): UnionPageItem[] => {
    if (targetUserIds.length === 0) return [];

    // 대상 사용자들의 페이지를 수집
    const pageMap = new Map<string, UnionPageItem>();

    for (const page of pages) {
      if (!targetUserIds.includes(page.ownerUserId)) continue;

      // 페이지 주소를 키로 사용
      const key = `${page.address.section}.${page.address.owner}.${page.address.book}.${page.address.page}`;

      if (pageMap.has(key)) {
        // 이미 있으면 소유자 목록에 추가
        const existing = pageMap.get(key)!;
        if (!existing.owners.includes(page.ownerUserId)) {
          existing.owners.push(page.ownerUserId);
        }
        // 더 이른 생성 시간 사용
        existing.createdAt = Math.min(existing.createdAt, page.createdAt);
      } else {
        // 새 페이지 추가
        pageMap.set(key, {
          address: page.address,
          owners: [page.ownerUserId],
          createdAt: page.createdAt,
        });
      }
    }

    // 정렬: 마우스 페이지 먼저, 그 다음 생성 시간순
    return Array.from(pageMap.values()).sort((a, b) => {
      const aIsMouse = isMousePage(a.address);
      const bIsMouse = isMousePage(b.address);
      if (aIsMouse && !bIsMouse) return -1;
      if (!aIsMouse && bIsMouse) return 1;
      return a.createdAt - b.createdAt;
    });
  }, [targetUserIds, pages]);

  // 단일 사용자 모드용 페이지 목록 (기존 호환성 유지)
  const userPages = useMemo(() => {
    if (!viewingUserId || isMultiUserMode) return [];
    return pages
      .filter((p) => p.ownerUserId === viewingUserId)
      .sort((a, b) => {
        const aIsMouse = isMousePage(a.address);
        const bIsMouse = isMousePage(b.address);
        if (aIsMouse && !bIsMouse) return -1;
        if (!aIsMouse && bIsMouse) return 1;
        return a.createdAt - b.createdAt;
      });
  }, [viewingUserId, pages, isMultiUserMode]);

  /**
   * 페이지 선택
   */
  const handleSelectPage = useCallback((address: NcodePageAddress) => {
    setCurrentPage(address);
    setCurrentPageInStore(address);
    // 서버로 PAGE_CHANGE 메시지 전송 (다른 참가자들에게 브로드캐스트)
    strokeService.changePageByAddress(address);
  }, [setCurrentPage, setCurrentPageInStore]);

  /**
   * 새 마우스 페이지 추가
   * - viewingUserId가 현재 사용자이면 자신의 페이지 추가
   * - viewingUserId가 다른 사용자이면 그 사용자의 캔버스에 페이지 추가 (호스트만 가능)
   */
  const handleAddPage = useCallback(() => {
    if (!viewingUserId) return;
    const newAddress = addMousePage(viewingUserId);
    setCurrentPage(newAddress);
    setCurrentPageInStore(newAddress);
    // 서버로 PAGE_ADD 메시지 전송 (ownerUserId = viewingUserId)
    strokeService.addPage(viewingUserId, newAddress);
  }, [viewingUserId, addMousePage, setCurrentPage, setCurrentPageInStore]);

  /**
   * 페이지 삭제
   */
  const handleDeletePage = useCallback((page: PageInfo) => {
    if (!viewingUserId) return;
    // 서버로 PAGE_DELETE 메시지 전송 및 로컬 삭제
    strokeService.deletePage(page.address);
    setContextMenu(null);
  }, [viewingUserId]);

  /**
   * 컨텍스트 메뉴 열기
   */
  const handleContextMenu = useCallback((e: React.MouseEvent, page: PageInfo) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      page,
    });
  }, []);

  /**
   * 컨텍스트 메뉴 닫기
   */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /**
   * 페이지 표시 라벨
   */
  const getPageLabel = (page: PageInfo): string => {
    const addr = page.address;
    if (isMousePage(addr)) {
      return t('page.mouse');
    }
    return formatPageAddress(addr);
  };

  /**
   * 페이지 아이콘 (마우스 vs 펜)
   */
  const getPageIcon = (address: NcodePageAddress) => {
    if (isMousePage(address)) {
      // Mouse icon
      return (
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
      );
    }
    // Pen icon
    return (
      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    );
  };

  /**
   * 소유자 표시 (복수 사용자 모드에서)
   */
  const renderOwnerIndicators = (owners: string[]) => {
    if (!isMultiUserMode || targetUserIds.length <= 1) return null;

    // 대상 사용자 중 이 페이지를 소유하지 않은 사용자 확인
    const missingOwners = targetUserIds.filter((id) => !owners.includes(id));

    return (
      <div className="flex items-center gap-0.5 mt-0.5">
        {targetUserIds.map((userId) => {
          const hasPage = owners.includes(userId);
          const color = getUserColor(userId);
          const participant = getParticipant(userId);

          return (
            <div
              key={userId}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: hasPage ? color : '#e5e7eb',
                border: hasPage ? 'none' : `1px dashed ${color}`,
              }}
              title={`${participant?.userName ?? userId}: ${hasPage ? t('page.owned') : t('page.notOwned')}`}
            />
          );
        })}
        {missingOwners.length > 0 && (
          <span className="text-[8px] text-gray-400 ml-0.5">
            +{missingOwners.length}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-transparent p-2 xl:p-4 flex flex-col h-full ${className}`}>
      {/* 헤더와 Lock 체크박스 */}
      {/* 헤더와 Lock 체크박스 */}
      <div className="flex items-center mb-2 xl:mb-3 flex-shrink-0">
        <label className="flex items-center gap-1 xl:gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={pageNavigationLocked}
            onChange={togglePageNavigationLock}
            className="w-3 h-3 xl:w-4 xl:h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs xl:text-sm text-gray-600">{t('page.lock')}</span>
        </label>
      </div>

      {/* 페이지 리스트 */}
      <div className="space-y-1 xl:space-y-2 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {/* 복수 사용자 모드: 합집합 페이지 표시 */}
        {isMultiUserMode ? (
          unionPages.length === 0 ? (
            <div className="text-xs xl:text-sm text-gray-500 text-center py-4">
              {t('page.noPagesYet')}
            </div>
          ) : (
            unionPages.map((unionPage) => {
              const isSelected = isSamePageAddress(unionPage.address, currentPageAddress);
              const isMouse = isMousePage(unionPage.address);
              const allOwnersHave = unionPage.owners.length === targetUserIds.length;

              return (
                <button
                  key={`union-${unionPage.address.section}.${unionPage.address.owner}.${unionPage.address.book}.${unionPage.address.page}`}
                  ref={isSelected ? selectedPageRef : null}
                  onClick={() => handleSelectPage(unionPage.address)}
                  className={`w-full flex items-center gap-2 xl:gap-3 p-1 xl:p-2 rounded-lg transition-colors text-left ${isSelected
                    ? 'bg-blue-100 border-2 border-blue-500'
                    : allOwnersHave
                      ? 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                      : 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
                    }`}
                >
                  {/* 썸네일 영역 */}
                  <div className={`w-8 h-10 xl:w-12 xl:h-16 rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-200' : 'bg-white border border-gray-300'
                    }`}>
                    {getPageIcon(unionPage.address)}
                  </div>

                  {/* 페이지 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs xl:text-sm font-medium truncate ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                      {isMouse ? t('page.mouse') : formatPageAddress(unionPage.address)}
                    </div>
                    <div className="text-[10px] xl:text-xs text-gray-500 font-mono truncate">
                      {isMouse ? `1024.1.1.${unionPage.address.page}` : formatPageAddress(unionPage.address)}
                    </div>
                    {/* 소유자 표시 */}
                    {renderOwnerIndicators(unionPage.owners)}
                  </div>
                </button>
              );
            })
          )
        ) : (
          /* 단일 사용자 모드: 기존 방식 */
          userPages.length === 0 ? (
            <div className="text-xs xl:text-sm text-gray-500 text-center py-4">
              {t('page.noPagesYet')}
            </div>
          ) : (
            userPages.map((page) => {
              const isSelected = isSamePageAddress(page.address, currentPageAddress);
              const isMouse = isMousePage(page.address);

              return (
                <button
                  key={`${page.ownerUserId}-${page.address.section}.${page.address.owner}.${page.address.book}.${page.address.page}`}
                  ref={isSelected ? selectedPageRef : null}
                  onClick={() => handleSelectPage(page.address)}
                  onContextMenu={(e) => handleContextMenu(e, page)}
                  className={`w-full flex items-center gap-2 xl:gap-3 p-1 xl:p-2 rounded-lg transition-colors text-left ${isSelected
                    ? 'bg-blue-100 border-2 border-blue-500'
                    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  {/* 썸네일 영역 */}
                  <div className={`w-8 h-10 xl:w-12 xl:h-16 rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-200' : 'bg-white border border-gray-300'
                    }`}>
                    {getPageIcon(page.address)}
                  </div>

                  {/* 페이지 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs xl:text-sm font-medium truncate ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                      {getPageLabel(page)}
                    </div>
                    <div className="text-[10px] xl:text-xs text-gray-500 font-mono truncate">
                      {isMouse ? `1024.1.1.${page.address.page}` : formatPageAddress(page.address)}
                    </div>
                  </div>
                </button>
              );
            })
          )
        )}
      </div>

      {/* 새 마우스 페이지 추가 버튼 */}
      <div className="mt-2 flex-shrink-0">
        <button
          onClick={handleAddPage}
          disabled={!viewingUserId}
          className="w-full mt-2 xl:mt-3 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors flex items-center justify-center gap-1.5 xl:gap-2"
          title={t('page.addPageTooltip')}
        >
          <svg className="w-3 h-3 xl:w-4 xl:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('page.addPage')}
        </button>
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <>
          {/* 배경 클릭 시 닫기 */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleCloseContextMenu}
          />
          {/* 메뉴 */}
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleDeletePage(contextMenu.page)}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t('page.deletePage')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PageNavigation;
