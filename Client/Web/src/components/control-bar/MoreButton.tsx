import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { useSessionStore } from '../../stores/session-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

interface MoreButtonProps {
  onCopySessionCode?: () => void;
  onCopyInviteLink?: () => void;
}

/**
 * 더보기 메뉴 버튼
 * - About (서비스 소개)
 * - showAllButtons가 false일 때 숨겨진 버튼들의 기능 표시:
 *   - Upload (PDF 업로드)
 *   - My Materials (내 자료)
 *   - Session Info (세션 코드/링크 복사)
 *   - Settings
 */
export const MoreButton: React.FC<MoreButtonProps> = ({
  onCopySessionCode,
  onCopyInviteLink,
}) => {
  const { t } = useTranslation();
  const { compact, showAllButtons } = useControlBarContext();
  const isMoreMenuOpen = usePanelStore((state) => state.isMoreMenuOpen);
  const setMoreMenuOpen = usePanelStore((state) => state.setMoreMenuOpen);
  const setAboutOpen = usePanelStore((state) => state.setAboutOpen);
  const setSettingsOpen = usePanelStore((state) => state.setSettingsOpen);
  const togglePdfUpload = usePanelStore((state) => state.togglePdfUpload);
  const toggleLeftPanel = usePanelStore((state) => state.toggleLeftPanel);

  const session = useSessionStore((state) => state.session);
  const isHost = useSessionStore((state) => state.isHost);

  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };

    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreMenuOpen, setMoreMenuOpen]);

  const icon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  );

  return (
    <div className="relative" ref={menuRef}>
      <ControlBarButton
        icon={icon}
        label={t('controlBar.more', 'More')}
        onClick={() => setMoreMenuOpen(!isMoreMenuOpen)}
        isActive={isMoreMenuOpen}
        tooltip={t('controlBar.moreTip', 'More options')}
        compact={compact}
      />

      {/* 더보기 메뉴 */}
      {isMoreMenuOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-white/95 backdrop-blur-xl rounded-lg shadow-lg border border-gray-200/50 py-1 z-50">
          {/* 숨겨진 버튼들 - showAllButtons가 false일 때만 표시 */}
          {!showAllButtons && (
            <>
              {/* 세션 정보 섹션 */}
              {session && (
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${isHost ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                    <span className="text-xs font-medium text-gray-700">
                      {isHost ? t('session.hostRole', 'Session Host') : t('session.guestRole', 'Session Guest')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {t('session.code', 'Code')}: <span className="font-mono">{session.code}</span>
                  </div>
                </div>
              )}

              {/* 세션 코드 복사 */}
              {onCopySessionCode && (
                <button
                  type="button"
                  onClick={() => {
                    onCopySessionCode();
                    setMoreMenuOpen(false);
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
                    setMoreMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {t('sessionMenu.copyLink', 'Copy Invite Link')}
                </button>
              )}

              <div className="border-t border-gray-200 my-1" />

              {/* PDF 업로드 */}
              <button
                type="button"
                onClick={() => {
                  togglePdfUpload();
                  setMoreMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('controlBar.upload', 'Upload')}
              </button>

              {/* 내 자료 */}
              <button
                type="button"
                onClick={() => {
                  toggleLeftPanel('myPapers');
                  setMoreMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {t('controlBar.myMaterials', 'My Materials')}
              </button>

              {/* Settings */}
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true);
                  setMoreMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('controlBar.settings', 'Settings')}
              </button>

              <div className="border-t border-gray-200 my-1" />
            </>
          )}

          {/* About - 항상 표시 */}
          <button
            type="button"
            onClick={() => {
              setAboutOpen(true);
              setMoreMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('controlBar.about', 'About')}
          </button>
        </div>
      )}
    </div>
  );
};

export default MoreButton;
