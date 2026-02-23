import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import watercolorBg from '../assets/watercolor-bg.png';

type Mode = 'host' | 'guest' | null;

export default function Login() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<Mode>(null);
    const [name, setName] = useState('');

    function selectMode(m: Mode) {
        setMode(prev => (prev === m ? null : m));
        setName('');
    }

    function handleEnter() {
        if (!name.trim()) return;
        if (mode === 'host') {
            localStorage.setItem('nc_host_nickname', name.trim());
            if (!localStorage.getItem('nc_host_id')) {
                localStorage.setItem('nc_host_id', `host_${Date.now()}`);
            }
            navigate('/host');
        } else if (mode === 'guest') {
            localStorage.setItem('nc_guest_nickname', name.trim());
            navigate('/join');
        }
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden font-sans relative">
            <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60" style={{ backgroundImage: `url(${watercolorBg})` }} />
            <div className="absolute inset-0 z-0 bg-white/40 pointer-events-none" />

            <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-4">
                {/* Logo */}
                <div className="mb-10 text-center">
                    <div className="flex items-center justify-center text-4xl font-black mb-2">
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
                        <span className="text-gray-800">CAST</span>
                    </div>
                    <p className="text-sm text-gray-500">실시간 필기 협업 플랫폼</p>
                </div>

                {/* 버튼 카드 2개 */}
                <div className="w-full max-w-sm space-y-4">

                    {/* 선생님 */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-lg overflow-hidden">
                        <button
                            onClick={() => selectMode('host')}
                            className="w-full flex items-center gap-4 p-5 text-left hover:bg-blue-50/40 transition-colors"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                                👩‍🏫
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-800">선생님으로 입장</p>
                                <p className="text-xs text-gray-400 mt-0.5">세션 개설 및 학생 모니터링</p>
                            </div>
                            <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${mode === 'host' ? 'rotate-90' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        {mode === 'host' && (
                            <div className="px-5 pb-5 flex gap-2 animate-fade-in">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleEnter()}
                                    placeholder="이름을 입력하세요"
                                    autoFocus
                                    maxLength={20}
                                    className="flex-1 px-4 py-2.5 bg-white/80 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-400 text-gray-800"
                                />
                                <button
                                    onClick={handleEnter}
                                    disabled={!name.trim()}
                                    className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
                                >
                                    입장 →
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 학생 */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-lg overflow-hidden">
                        <button
                            onClick={() => selectMode('guest')}
                            className="w-full flex items-center gap-4 p-5 text-left hover:bg-purple-50/40 transition-colors"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                                🧑‍🎓
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-800">학생으로 입장</p>
                                <p className="text-xs text-gray-400 mt-0.5">입장 코드로 세션 참가</p>
                            </div>
                            <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${mode === 'guest' ? 'rotate-90' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        {mode === 'guest' && (
                            <div className="px-5 pb-5 flex gap-2 animate-fade-in">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleEnter()}
                                    placeholder="이름을 입력하세요"
                                    autoFocus
                                    maxLength={20}
                                    className="flex-1 px-4 py-2.5 bg-white/80 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all placeholder-gray-400 text-gray-800"
                                />
                                <button
                                    onClick={handleEnter}
                                    disabled={!name.trim()}
                                    className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm"
                                >
                                    입장 →
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <p className="mt-8 text-center text-xs text-gray-400">© 2025 NeoLAB Convergence Inc.</p>
            </div>
        </div>
    );
}
