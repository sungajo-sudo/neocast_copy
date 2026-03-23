import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SessionLobby } from '../components/session';
import { useSessionStore } from '../stores/session-store';
export function LobbyPage() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const navigate = useNavigate();

  // 세션이 활성화되면 세션 페이지로 이동
  useEffect(() => {
    if (session) {
      navigate(`/session/${session.code}`, { replace: true, state: { justJoined: true } });
    }
  }, [session, navigate]);

  return (
    <div className="h-full relative overflow-hidden font-sans flex flex-col">
      {/* Main Content Container */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-8">

        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-5 lg:gap-8 lg:bg-white lg:rounded-3xl lg:shadow-[var(--shadow-modern)] lg:p-8 lg:border lg:border-[#fff1e6]">

          {/* Left Side: Info / Intro */}
          <div className="hidden lg:flex lg:col-span-2 flex-col justify-center space-y-6 lg:border-r lg:border-gray-200/50 lg:pr-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                {t('lobby.welcome')}
              </h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {t('lobby.welcomeDescription')}
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-[#fafafa] p-4 rounded-2xl border border-[#fff1e6]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  </div>
                  <h3 className="font-semibold text-gray-800">{t('lobby.newSession')}</h3>
                </div>
                <p className="text-sm text-gray-500">
                  {t('lobby.newSessionDescription')}
                </p>
              </div>

              <div className="bg-[#fafafa] p-4 rounded-2xl border border-[#fff1e6]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </div>
                  <h3 className="font-semibold text-gray-800">{t('lobby.joinSession')}</h3>
                </div>
                <p className="text-sm text-gray-500">
                  {t('lobby.joinSessionDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: SessionLobby Component */}
          <div className="lg:col-span-3 flex items-center justify-center">
            <SessionLobby className="w-full" />
          </div>

        </div>

      </div>

      {/* Footer text */}
      <div className="relative z-10 py-4 text-center text-xs text-gray-500">
        {t('common.copyright')}
      </div>
    </div>
  );
}
