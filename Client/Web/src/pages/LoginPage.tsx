import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
export function LoginPage() {
  const navigate = useNavigate();
  const { devMockLogin } = useAuthStore();

  const handleStart = () => {
    // auth-store mock 세팅 (SessionLobby 로직 사용을 위해 필요)
    devMockLogin('host');
    // nc_auth localStorage 세팅
    localStorage.setItem('nc_auth', JSON.stringify({
      userId: 'mock_host',
      nickname: '선생님 (Mock)',
      role: 'host',
    }));
    navigate('/home');
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* 로그인 카드 */}
      <div className="relative z-10 w-full max-w-sm neo-card p-10 flex flex-col items-center gap-6">
        <div className="flex items-center gap-1">
          <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Neo
          </span>
          <span className="text-3xl font-bold text-gray-800">CAST</span>
        </div>

        <p className="text-gray-500 text-sm text-center">
          스마트 필기 협업 플랫폼
        </p>

        <button
          onClick={handleStart}
          className="w-full neo-btn-primary text-base"
        >
          테스트 버전으로 시작
        </button>
      </div>
    </div>
  );
}
