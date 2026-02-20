import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  userName: string;
  userId: string;
  isHost?: boolean;
  isSmartpenTarget?: boolean;
  onSmartpenInput: (userId: string) => void;
  onPromoteToHost: (userId: string) => void;
  onKick: (userId: string, userName: string) => void;
  onSpotlightShare?: (userId: string) => void;
  onClose: () => void;
}

/**
 * 캔버스 컨텍스트 메뉴 (우클릭 메뉴)
 * - 스마트펜 입력: 해당 사용자의 캔버스에 스마트펜 입력 대상 설정
 * - 호스트 임명: 해당 사용자를 호스트로 승격
 * - 내보내기: 해당 사용자를 세션에서 퇴출
 */
export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  x,
  y,
  userName,
  userId,
  isHost = true,
  isSmartpenTarget,
  onSmartpenInput,
  onPromoteToHost,
  onKick,
  onSpotlightShare,
  onClose,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // 약간의 지연 후 이벤트 리스너 등록 (현재 클릭 이벤트와 충돌 방지)
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 메뉴가 화면 밖으로 나가지 않도록 위치 조정
  useEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 오른쪽으로 넘어가면 왼쪽으로 이동
      if (rect.right > viewportWidth) {
        menu.style.left = `${x - rect.width}px`;
      }

      // 아래로 넘어가면 위로 이동
      if (rect.bottom > viewportHeight) {
        menu.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  const handleSmartpenInput = () => {
    onSmartpenInput(userId);
    onClose();
  };

  const handlePromoteToHost = () => {
    onPromoteToHost(userId);
    onClose();
  };

  const handleKick = () => {
    onKick(userId, userName);
    onClose();
  };

  const handleSpotlightShare = () => {
    onSpotlightShare?.(userId);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {isHost && (
        <>
          {/* 스마트펜 입력 */}
          <button
            type="button"
            onClick={handleSmartpenInput}
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
              isSmartpenTarget
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            {t('participant.smartpenInput')}
          </button>

          {/* 주목으로 공유 */}
          {onSpotlightShare && (
            <button
              type="button"
              onClick={handleSpotlightShare}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
              </svg>
              {t('participant.spotlightShare')}
            </button>
          )}

          <div className="border-t border-gray-100 my-1" />

          {/* 호스트 임명 */}
          <button
            type="button"
            onClick={handlePromoteToHost}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {t('participant.promoteToHost')}
          </button>

          <div className="border-t border-gray-100 my-1" />

          {/* 내보내기 */}
          <button
            type="button"
            onClick={handleKick}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('participant.kick')}
          </button>
        </>
      )}
    </div>
  );
};

export default CanvasContextMenu;
