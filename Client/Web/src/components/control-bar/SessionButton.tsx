import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

interface SessionButtonProps {
  onCopySessionCode?: () => void;
  onCopyInviteLink?: () => void;
}

/**
 * 세션 버튼 (호스트/게스트 뱃지)
 * - 호스트: 왕관 아이콘 (노란색)
 * - 게스트: 사용자 아이콘 (파란색)
 * - 클릭 시 세션 관련 드롭다운 메뉴 표시
 */
export const SessionButton: React.FC<SessionButtonProps> = ({
  onCopySessionCode,
  onCopyInviteLink,
}) => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const session = useSessionStore((state) => state.session);
  const isHost = useSessionStore((state) => state.isHost);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  if (!session) return null;

  // 아이콘: 호스트는 왕관, 게스트는 사용자
  const icon = isHost ? (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );

  const label = isHost ? t('participant.host', 'Host') : t('participant.guest', 'Guest');

  return (
    <div className="relative" ref={menuRef}>
      <ControlBarButton
        icon={icon}
        label={label}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        isActive={isMenuOpen}
        variant={isHost ? 'warning' : 'default'}
        tooltip={isHost ? t('controlBar.sessionHostTip', 'You are the host') : t('controlBar.sessionGuestTip', 'You are a guest')}
        compact={compact}
      />

      {/* 드롭다운 메뉴 */}
      {isMenuOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-white/95 backdrop-blur-xl rounded-lg shadow-lg border border-gray-200/50 py-1 z-50">
          {/* 세션 정보 */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${isHost ? 'bg-yellow-500' : 'bg-blue-500'}`} />
              <span className="text-sm font-medium text-gray-800">
                {isHost ? t('session.hostRole', 'Session Host') : t('session.guestRole', 'Session Guest')}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {t('session.code', 'Code')}: <span className="font-mono">{session.code}</span>
            </div>
            <div className="text-xs text-gray-500">
              {t('session.participants', 'Participants')}: {session.participants?.length || 1}
            </div>
          </div>

          {/* 세션 코드 복사 */}
          {onCopySessionCode && (
            <button
              type="button"
              onClick={() => {
                onCopySessionCode();
                setIsMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {t('sessionMenu.copyCode', 'Copy Code')}
            </button>
          )}

          {/* 초대 링크 복사 */}
          {onCopyInviteLink && (
            <button
              type="button"
              onClick={() => {
                onCopyInviteLink();
                setIsMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {t('sessionMenu.copyLink', 'Copy Invite Link')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SessionButton;
