import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import watercolorBg from '../assets/watercolor-bg.png';

export default function DemoEntry() {
    const navigate = useNavigate();
    const { socketUrl, setSession } = useSessionStore();
    const API = socketUrl;

    const [tab, setTab] = useState<'host' | 'guest'>('host');
    const [nickname, setNickname] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleGuest() {
        if (!nickname.trim()) { setError('닉네임을 입력해주세요.'); return; }
        if (!/^\d{6}$/.test(code)) { setError('6자리 숫자 코드를 입력해주세요.'); return; }
        setLoading(true); setError('');
        try {
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
            const joinRes = await fetch(`${API}/api/sessions/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: nickname.trim(), code }),
            });
            if (!joinRes.ok) { setError('세션을 찾을 수 없습니다.'); return; }
            const data = await joinRes.json();
            setSession({ sessionId: data.sessionId, userId: data.userId, nickname: nickname.trim(), role: 'guest', code: data.code });
            navigate('/session');
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }

    async function handleHostDirect() {
        if (!nickname.trim()) { setError('닉네임을 입력해주세요.'); return; }
        setLoading(true); setError('');
        try {
            const res = await fetch(`${API}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: nickname.trim() }),
            });
            if (!res.ok) throw new Error('서버 오류');
            const data = await res.json();
            setSession({ sessionId: data.sessionId, userId: data.userId, nickname: nickname.trim(), role: 'host', code: data.code });
            navigate('/session');
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden font-sans relative">
            {/* Watercolor background */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
                style={{ backgroundImage: `url(${watercolorBg})` }}
            />
            <div className="absolute inset-0 z-0 bg-white/40 pointer-events-none" />

            {/* Header */}
            <header className="relative z-20 bg-white/70 backdrop-blur-md border-b border-white/50 px-6 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="flex items-center text-xl font-bold">
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
                        <span className="text-gray-800">CAST</span>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Demo</span>
                </div>
            </header>

            {/* Main */}
            <div className="flex-1 flex items-center justify-center p-4 relative z-10">
                <div className="w-full max-w-5xl flex rounded-3xl overflow-hidden shadow-2xl bg-white/70 backdrop-blur-md border border-white/50 min-h-[560px]">

                    {/* Left: Description */}
                    <div className="hidden md:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                        <div>
                            <div className="flex items-center mb-8">
                                <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
                                <span className="text-3xl font-bold text-gray-800">CAST</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-3 leading-snug">
                                실시간 필기를 공유하고<br />
                                <span className="text-blue-600">함께 배우세요</span>
                            </h2>
                            <p className="text-gray-500 text-base leading-relaxed">
                                선생님의 화면을 학생들과 실시간으로 공유하고,
                                개별 첨삭까지 한 번에 가능한 협업 필기 플랫폼
                            </p>
                        </div>
                        <div className="space-y-3">
                            {[
                                { icon: '✏️', text: '스마트펜 실시간 필기 공유' },
                                { icon: '👀', text: '학생 캔버스 실시간 모니터링' },
                                { icon: '📝', text: '개별 첨삭 및 피드백' },
                            ].map(f => (
                                <div key={f.text} className="flex items-center gap-3 text-gray-600">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">{f.icon}</div>
                                    <span className="text-sm font-medium">{f.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Form */}
                    <div className="w-full md:w-1/2 p-8 sm:p-12 bg-white/50 flex flex-col justify-center">
                        {/* Tabs */}
                        <div className="flex gap-1 mb-8 bg-gray-100/80 rounded-xl p-1">
                            {([
                                { key: 'host', label: '👩‍🏫 선생님' },
                                { key: 'guest', label: '🧑‍🎓 학생' },
                            ] as const).map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => { setTab(t.key); setError(''); }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === t.key
                                        ? 'bg-white shadow text-gray-800'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            {/* Nickname */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">닉네임</label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={e => setNickname(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && tab === 'guest' && handleGuest()}
                                    placeholder={tab === 'host' ? '예: 김선생님' : '예: 홍길동'}
                                    maxLength={20}
                                    className="w-full px-4 py-3 bg-white/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-400 text-gray-800"
                                />
                            </div>

                            {/* Code (guest only) */}
                            {tab === 'guest' && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">입장 코드</label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        onKeyDown={e => e.key === 'Enter' && handleGuest()}
                                        placeholder="6자리 숫자"
                                        maxLength={6}
                                        className="w-full px-4 py-3 bg-white/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-400 text-gray-800 text-center text-2xl tracking-[0.4em] font-bold"
                                    />
                                </div>
                            )}

                            {error && (
                                <p className="text-sm text-red-500 flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {error}
                                </p>
                            )}

                            {tab === 'host' ? (
                                <div className="space-y-2 pt-1">
                                    <button
                                        onClick={() => {
                                            if (!nickname.trim()) { setError('닉네임을 입력해주세요.'); return; }
                                            localStorage.setItem('nc_host_nickname', nickname.trim());
                                            localStorage.setItem('nc_host_id', `host_${nickname.trim()}_${Date.now()}`);
                                            navigate('/host');
                                        }}
                                        className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:ring-4 focus:ring-blue-500/30 transition-all font-bold text-base shadow-md hover:shadow-lg"
                                    >
                                        📚 내 수업방 목록으로 →
                                    </button>
                                    <button
                                        onClick={handleHostDirect}
                                        disabled={loading}
                                        className="w-full py-2.5 px-4 bg-white/60 border border-gray-200 text-gray-600 rounded-xl hover:bg-white/90 transition-all text-sm font-medium disabled:opacity-50"
                                    >
                                        {loading ? '처리 중...' : '+ 임시 세션 바로 시작'}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleGuest}
                                    disabled={loading}
                                    className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-base shadow-md hover:shadow-lg mt-1"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            처리 중...
                                        </span>
                                    ) : '세션 참가 →'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
