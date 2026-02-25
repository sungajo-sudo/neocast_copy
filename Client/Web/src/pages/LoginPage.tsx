import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthPanel } from '../components/auth';
import { useAuthStore } from '../stores/auth-store';
import type { InviteData } from '../utils/invite';
import watercolorBg from '../assets/images/watercolor-bg.png';

const IS_DEV = import.meta.env.DEV;

export function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, login } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [testLoginLoading, setTestLoginLoading] = useState<'host' | 'guest' | null>(null);

  // 초대 링크로 접속한 경우 inviteData 확인
  const inviteData: InviteData | undefined = (location.state as { inviteData?: InviteData })?.inviteData;

  useEffect(() => {
    if (isAuthenticated) {
      // 이전 페이지로 또는 로비로 리다이렉트
      // inviteData가 있으면 함께 전달 (비밀번호 없이 세션 참가 가능하도록)
      const from = (location.state as { from?: Location })?.from?.pathname || '/';
      navigate(from, { replace: true, state: { inviteData } });
    }
  }, [isAuthenticated, location, navigate, inviteData]);

  if (isAuthenticated) {
    return null;
  }

  // 테스트 로그인 핸들러 (개발 환경 전용)
  const handleTestLogin = async (role: 'host' | 'guest') => {
    setTestLoginLoading(role);
    const credentials = {
      host: { email: 'host@abc.com', password: '1234' },
      guest: { email: 'guest@abc.com', password: '1234' },
    };
    const { email, password } = credentials[role];
    await login(email, password);
    setTestLoginLoading(null);
  };

  // "로그인 없이 참가" 버튼 클릭 핸들러
  const handleGuestJoin = () => {
    if (inviteData) {
      navigate('/guest-join', { state: { inviteData } });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans flex items-center justify-center p-4">
      {/* Background with texture overlay */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${watercolorBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-white/40 pointer-events-none" />

      {/* Login Card Container */}
      <div className="relative z-10 w-full max-w-5xl flex rounded-3xl overflow-hidden shadow-2xl bg-white/70 backdrop-blur-md border border-white/50">

        {/* Left Side: Welcome / Info (Hidden on mobile) */}
        <div className="hidden md:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <div>
            <div className="flex items-center mb-8">
              <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Neo
              </span>
              <span className="text-3xl font-bold text-gray-800">CAST</span>
            </div>

            <h2 className="text-3xl font-bold text-gray-800 mb-4 leading-tight">
              {t('description.title')}<br />
              <span className="text-blue-600">{t('description.titleHighlight')}</span>{t('description.titleSuffix')}
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              {t('description.subtitleLogin')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 text-gray-600">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </div>
              <span className="font-medium">{t('description.featurePen')}</span>
            </div>
            <div className="flex items-center gap-4 text-gray-600">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <span className="font-medium">{t('description.featureCollab')}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 bg-white/50">
          <div className="max-w-md mx-auto h-full flex flex-col justify-center">
            <div className="md:hidden flex items-center mb-8 justify-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Neo
              </span>
              <span className="text-2xl font-bold text-gray-800">CAST</span>
            </div>

            <AuthPanel initialMode="login" />

            {/* 개발 환경 전용: 테스트 로그인 버튼 */}
            {IS_DEV && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-xs text-yellow-700 font-medium mb-2 text-center">
                  🛠 개발 환경 — 테스트 로그인
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestLogin('host')}
                    disabled={testLoginLoading !== null}
                    className="flex-1 py-2 px-3 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {testLoginLoading === 'host' ? '로그인 중...' : '🎓 호스트'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestLogin('guest')}
                    disabled={testLoginLoading !== null}
                    className="flex-1 py-2 px-3 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    {testLoginLoading === 'guest' ? '로그인 중...' : '👤 게스트'}
                  </button>
                </div>
              </div>
            )}

            {/* 초대 링크로 접속한 경우 게스트 참가 버튼 표시 */}
            {inviteData && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">
                    {t('guest.noAccountQuestion')}
                  </p>
                  <button
                    onClick={handleGuestJoin}
                    className="w-full py-3 px-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium shadow-md hover:shadow-lg transform active:scale-95 transition-transform"
                  >
                    {t('guest.joinWithoutLogin')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer text */}
      <div className="absolute bottom-4 text-center w-full text-xs text-gray-500">
        {t('common.copyright')}
      </div>
    </div>
  );
}
