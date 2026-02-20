import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import { useConnectionStore } from '../../stores/connection-store';
import { strokeService } from '../../services/stroke-service';
import { sessionService } from '../../services/session-service';
import { useAuthStore } from '../../stores/auth-store';
import { createInviteLink } from '../../utils/invite';
import { copyToClipboard } from '../../utils/clipboard';

interface SessionInviteProps {
  className?: string;
}

/**
 * 호스트용 세션 초대 및 관리 패널
 */
export const SessionInvite: React.FC<SessionInviteProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { session, isHost, clearSession, setInviteToken } = useSessionStore();
  const { disconnect } = useConnectionStore();
  const { tokens } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isFetchingToken, setIsFetchingToken] = useState(false);

  // 호스트인데 inviteToken이 없으면 서버에서 가져오기
  useEffect(() => {
    if (!session || !isHost || session.inviteToken || !tokens?.accessToken) return;

    const fetchInviteToken = async () => {
      setIsFetchingToken(true);
      try {
        const response = await sessionService.getSessionById(tokens.accessToken, session.id);
        if (response.session.inviteToken) {
          setInviteToken(response.session.inviteToken);
          console.log('[SessionInvite] Fetched inviteToken from server');
        }
      } catch (error) {
        console.error('[SessionInvite] Failed to fetch inviteToken:', error);
      } finally {
        setIsFetchingToken(false);
      }
    };

    fetchInviteToken();
  }, [session?.id, isHost, session?.inviteToken, tokens?.accessToken, setInviteToken]);

  // inviteToken이 준비될 때까지 대기 필요 여부
  const isInviteLinkReady = !!(session?.inviteToken) || !session?.hasPassword;

  // 초대 링크 생성 (inviteToken 포함하여 비밀번호 없이 참가 가능)
  const inviteLink = useMemo(() => {
    if (!session) return '';
    // DEBUG: 초대 링크 생성 시 inviteToken 확인
    console.log('[SessionInvite] Creating invite link:', {
      code: session.code,
      inviteToken: session.inviteToken,
      hasPassword: session.hasPassword,
    });
    return createInviteLink(window.location.origin, {
      code: session.code,
      inviteToken: session.inviteToken ?? undefined,
    });
  }, [session]);

  if (!session) return null;

  // 클립보드 복사
  const handleCopyLink = useCallback(async () => {
    try {
      await copyToClipboard(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [inviteLink]);

  // 세션 코드 복사
  const handleCopyCode = useCallback(async () => {
    try {
      await copyToClipboard(session.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [session.code]);

  // 세션 나가기/종료
  const handleLeaveSession = useCallback(async () => {
    if (!tokens?.accessToken) return;

    setIsLeaving(true);
    try {
      if (isHost) {
        // 호스트는 세션 종료
        await sessionService.closeSession(tokens.accessToken, session.id);
      } else {
        // 게스트는 세션 나가기
        await sessionService.leaveSession(tokens.accessToken, session.id);
      }
      strokeService.disconnect();
      disconnect();
      clearSession();
    } catch (error) {
      console.error('Failed to leave session:', error);
    } finally {
      setIsLeaving(false);
    }
  }, [tokens, session.id, isHost, disconnect, clearSession]);

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">
        {isHost ? t('sessionMenu.endSession') : t('sessionMenu.leaveSession')}
      </h2>

      {/* 세션 정보 */}
      <div className="mb-4 p-3 bg-blue-50 rounded-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">{t('sessionJoin.code')}:</span>
          <div className="flex items-center">
            <span className="font-mono font-bold text-xl tracking-widest text-blue-600">
              {session.code}
            </span>
            <button
              onClick={handleCopyCode}
              className="ml-2 p-1 text-gray-500 hover:text-blue-500"
              title={t('sessionMenu.copyCode')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{t('session.currentParticipants')}:</span>
          <span className="font-medium">{t('session.participantCountSimple', { count: session.participants.length })}</span>
        </div>
      </div>

      {/* 호스트용 초대 옵션 */}
      {isHost && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('invite.copyLink')}
            {isFetchingToken && (
              <span className="ml-2 text-xs text-gray-500">({t('common.processing')})</span>
            )}
          </label>
          <div className="flex">
            <input
              type="text"
              value={isFetchingToken ? t('common.processing') : inviteLink}
              readOnly
              className={`flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-sm ${
                isInviteLinkReady ? 'text-gray-600' : 'text-gray-400 italic'
              }`}
            />
            <button
              onClick={handleCopyLink}
              disabled={isFetchingToken || !isInviteLinkReady}
              className={`px-3 py-2 rounded-r-md transition-colors ${
                copied
                  ? 'bg-green-500 text-white'
                  : isFetchingToken || !isInviteLinkReady
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title={copied ? t('common.copied') : isFetchingToken ? t('common.processing') : t('common.copy')}
            >
              {isFetchingToken ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : copied ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t('invite.subtitle')}
          </p>
        </div>
      )}

      {/* 세션 나가기/종료 버튼 */}
      <button
        onClick={handleLeaveSession}
        disabled={isLeaving}
        className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLeaving ? t('common.processing') : isHost ? t('sessionMenu.endSession') : t('sessionMenu.leaveSession')}
      </button>
    </div>
  );
};

export default SessionInvite;
