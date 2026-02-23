import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import watercolorBg from '../assets/watercolor-bg.png';

export default function GuestJoin() {
    const navigate = useNavigate();
    const { socketUrl, setSession } = useSessionStore();
    const API = socketUrl;

    const [nickname, setNickname] = useState(localStorage.getItem('nc_guest_nickname') || '');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleJoin() {
        if (!nickname.trim()) { setError('닉네임을 입력해주세요.'); return; }
        if (!/^\d{6}$/.test(code)) { setError('6자리 입장 코드를 입력해주세요.'); return; }
        setLoading(true); setError('');
        try {
            // Room 코드 확인 먼저
            const roomRes = await fetch(`${API}/api/rooms/by-code/${code}`);
            if (roomRes.ok) {
                const roomData = await roomRes.json();
                if (!roomData.isOpen) {
                    localStorage.setItem('nc_guest_nickname', nickname.trim());
                    localStorage.setItem('nc_waiting_code', code);
                    localStorage.setItem('nc_waiting_room_name', roomData.name);
                    localStorage.setItem('nc_waiting_host', roomData.hostNickname);
                    navigate('/waiting');
                    return;
                }
                const joinRes = await fetch(`${API}/api/sessions/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nickname: nickname.trim(), code }),
                });
                if (!joinRes.ok) { setError('세션 참가에 실패했습니다.'); return; }
                const data = await joinRes.json();
                setSession({ sessionId: data.sessionId, userId: data.userId, nickname: nickname.trim(), role: 'guest', code: data.code });
                navigate('/session');
                return;
            }
            // 일반 세션 코드 시도
            const joinRes = await fetch(`${API}/api/sessions/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: nickname.trim(), code }),
            });
            if (!joinRes.ok) { setError('세션을 찾을 수 없습니다. 코드를 다시 확인해주세요.'); return; }
            const data = await joinRes.json();
            setSession({ sessionId: data.sessionId, userId: data.userId, nickname: nickname.trim(), role: 'guest', code: data.code });
            navigate('/session');
        } catch {
            setError('서버에 연결할 수 없습니다.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden font-sans relative">
            {/* Watercolor background */}
            <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60" style={{ backgroundImage: `url(${watercolorBg})` }} />
            <div className="absolute inset-0 z-0 bg-white/40 pointer-events-none" />

            {/* Header */}
            <header className="relative z-20 bg-white/70 backdrop-blur-md border-b border-white/50 px-6 shadow-sm flex-shrink-0 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex items-center text-lg font-bold">
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
                        <span className="text-gray-800">CAST</span>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100/80 rounded-full px-2 py-0.5 border border-gray-200/50">학생 입장</span>
                </div>
            </header>

            {/* Main */}
            <div className="flex-1 flex items-center justify-center p-4 relative z-10">
                <div className="w-full max-w-md">
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl overflow-hidden">
                        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                        <div className="p-8 sm:p-10">
                            <div className="text-center mb-8">
                                <div className="text-4xl mb-3">🧑‍🎓</div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-1">세션 참가</h2>
                                <p className="text-sm text-gray-500">선생님께 받은 입장 코드를 입력하세요</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">닉네임</label>
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={e => setNickname(e.target.value)}
                                        placeholder="예: 홍길동"
                                        maxLength={20}
                                        className="w-full px-4 py-3 bg-white/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-400 text-gray-800"
                                        onKeyDown={e => e.key === 'Enter' && handleJoin()}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">입장 코드</label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        onKeyDown={e => e.key === 'Enter' && handleJoin()}
                                        placeholder="6자리 숫자"
                                        maxLength={6}
                                        className="w-full px-4 py-3 bg-white/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-400 text-gray-800 text-center text-3xl tracking-[0.5em] font-bold"
                                    />
                                </div>

                                {error && (
                                    <p className="text-sm text-red-500 flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {error}
                                    </p>
                                )}

                                <button
                                    onClick={handleJoin}
                                    disabled={loading}
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-base shadow-md hover:shadow-lg mt-2"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            입장 중...
                                        </span>
                                    ) : '세션 입장 →'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-6">© 2025 NeoLAB Convergence Inc.</p>
                </div>
            </div>
        </div>
    );
}
