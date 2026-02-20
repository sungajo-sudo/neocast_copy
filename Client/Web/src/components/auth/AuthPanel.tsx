import { useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth-store';

type AuthMode = 'login' | 'register';

const REMEMBER_EMAIL_KEY = 'neocast:rememberedEmail';
const REMEMBER_EMAIL_ENABLED_KEY = 'neocast:rememberEmailEnabled';

interface AuthPanelProps {
  className?: string;
  onAuthSuccess?: () => void;
  initialMode?: 'login' | 'signup';
}

/**
 * 로그인/회원가입 패널
 */
export const AuthPanel: React.FC<AuthPanelProps> = ({ className = '', onAuthSuccess, initialMode }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>(initialMode === 'signup' ? 'register' : 'login');
  // localStorage에서 저장된 이메일 불러오기
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_EMAIL_KEY) || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  // ID 보관하기 체크박스 (기본값: ON, localStorage에서 명시적으로 false로 설정한 경우에만 OFF)
  const [rememberEmail, setRememberEmail] = useState(() => {
    const saved = localStorage.getItem(REMEMBER_EMAIL_ENABLED_KEY);
    return saved !== 'false'; // 기본값 true
  });

  const { user, isAuthenticated, isLoading, error, login, register, logout, clearError } = useAuthStore();

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      clearError();

      if (mode === 'login') {
        const success = await login(email, password);
        if (success) {
          // ID 보관하기 설정에 따라 localStorage에 이메일 저장/삭제
          if (rememberEmail) {
            localStorage.setItem(REMEMBER_EMAIL_KEY, email);
            localStorage.setItem(REMEMBER_EMAIL_ENABLED_KEY, 'true');
          } else {
            localStorage.removeItem(REMEMBER_EMAIL_KEY);
            localStorage.setItem(REMEMBER_EMAIL_ENABLED_KEY, 'false');
          }
          onAuthSuccess?.();
        }
      } else {
        if (password !== confirmPassword) {
          return;
        }
        const success = await register(email, password, name);
        if (success) {
          onAuthSuccess?.();
        }
      }
    },
    [mode, email, password, confirmPassword, name, login, register, clearError, onAuthSuccess, rememberEmail]
  );

  const switchMode = useCallback(() => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    clearError();
    setPassword('');
    setConfirmPassword('');
  }, [clearError]);

  // 이미 로그인된 경우
  if (isAuthenticated && user) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-800">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            {t('common.logout')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">{mode === 'login' ? t('auth.loginTitle') : t('auth.signUpTitle')}</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 에러 메시지 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>
        )}

        {/* 이름 (회원가입 시) */}
        {mode === 'register' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
        )}

        {/* 이메일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* 비밀번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? t('auth.passwordRequirement') : t('auth.passwordPlaceholder')}
            required
            minLength={mode === 'register' ? 6 : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* ID 보관하기 체크박스 (로그인 모드에서만 표시) */}
        {mode === 'login' && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="rememberEmail"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              disabled={isLoading}
            />
            <label htmlFor="rememberEmail" className="ml-2 text-sm text-gray-600 cursor-pointer select-none">
              {t('auth.rememberEmail')}
            </label>
          </div>
        )}

        {/* 비밀번호 확인 (회원가입 시) */}
        {mode === 'register' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.confirmPassword')}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                confirmPassword && password !== confirmPassword
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300'
              }`}
              disabled={isLoading}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{t('auth.passwordMismatch')}</p>
            )}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isLoading || (mode === 'register' && password !== confirmPassword)}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? t('common.processing') : mode === 'login' ? t('auth.loginButton') : t('auth.signUpButton')}
        </button>
      </form>

      {/* 모드 전환 */}
      <div className="mt-4 text-center text-sm text-gray-600">
        {mode === 'login' ? (
          <>
            {t('auth.noAccount')}{' '}
            <button onClick={switchMode} className="text-blue-500 hover:underline font-medium">
              {t('common.signUp')}
            </button>
          </>
        ) : (
          <>
            {t('auth.hasAccount')}{' '}
            <button onClick={switchMode} className="text-blue-500 hover:underline font-medium">
              {t('common.login')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthPanel;
