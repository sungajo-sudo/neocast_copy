import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import watercolorBg from '../assets/images/watercolor-bg.png';

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
      {/* 수채화 배경 */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${watercolorBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-white/40 pointer-events-none" />

      {/* 로그인 카드 */}
      <div className="relative z-10 w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-10 flex flex-col items-center gap-6">
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
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl px-6 py-3 font-medium text-base hover:opacity-90 active:scale-95 transition-all shadow-md"
        >
          테스트 버전으로 시작
        </button>
      </div>
    </div>
  );
}
