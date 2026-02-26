import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import watercolorBg from '../assets/watercolor-bg.png';

export default function GuestWaiting() {
    const navigate = useNavigate();
    const { socketUrl, setSession } = useSessionStore();
    const API = socketUrl;

    const nickname = localStorage.getItem('nc_guest_nickname') || '학생';
    const code = localStorage.getItem('nc_waiting_code') || '';
    const roomName = localStorage.getItem('nc_waiting_room_name') || '세션';
    const hostName = localStorage.getItem('nc_waiting_host') || '선생님';

    const [dots, setDots] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState('');
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTime = useRef(Date.now());

    useEffect(() => {
        if (!code) { navigate('/'); }
    }, [code, navigate]);

    // 점 애니메이션
    useEffect(() => {
        const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
        return () => clearInterval(t);
    }, []);

    // 경과 시간
    useEffect(() => {
        const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
        return () => clearInterval(t);
    }, []);

    // 🧪 로컬 모드: localStorage 폴링
    useEffect(() => {
        if (!code) return;

        const poll = () => {
            try {
                const savedRooms = JSON.parse(localStorage.getItem('nc_rooms') || '[]');
                const room = savedRooms.find((r: any) => r.code === code);

                if (!room) {
                    setError('세션을 찾을 수 없습니다.');
                    return;
                }

                if (room.isOpen) {
                    // 세션이 열렸으면 자동 입장
                    const guestId = `guest-${Date.now()}`;
                    const sessionId = room.activeSessionId || `session-${Date.now()}`;

                    setSession({
                        sessionId,
                        userId: guestId,
                        nickname,
                        role: 'guest',
                        code: room.code
                    });

                    if (intervalRef.current) clearInterval(intervalRef.current);
                    navigate('/session');
                }
            } catch (err) {
                console.error('Poll error:', err);
            }
        };

        poll();
        intervalRef.current = setInterval(poll, 2000); // 2초마다 체크
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [code, navigate, nickname, setSession]);

    const formatElapsed = (s: number) => s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;

    return (
        <div className="h-screen flex flex-col overflow-hidden font-sans relative">
            {/* Watercolor background */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
                style={{ backgroundImage: `url(${watercolorBg})` }}
            />
            <div className="absolute inset-0 z-0 bg-white/40 pointer-events-none" />

            {/* Main */}
            <div className="flex-1 flex items-center justify-center p-4 relative z-10">
                <div className="w-full max-w-md">
                    {/* Card */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl overflow-hidden">
                        {/* Top accent */}
                        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                        <div className="p-8 sm:p-10 text-center">
                            {/* Logo */}
                            <div className="flex items-center justify-center gap-1 mb-6">
                                <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
                                <span className="text-lg font-bold text-gray-800">CAST</span>
                            </div>

                            {error ? (
                                <>
                                    <div className="text-4xl mb-4">⚠️</div>
                                    <p className="text-lg font-bold text-gray-800 mb-6">{error}</p>
                                    <button
                                        onClick={() => navigate('/')}
                                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all"
                                    >
                                        ← 처음으로
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Pulse animation */}
                                    <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full bg-blue-200/60 animate-pulse-ring" />
                                        <div className="absolute inset-3 rounded-full bg-blue-300/50 animate-pulse-ring [animation-delay:500ms]" />
                                        <div className="absolute inset-5 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center">
                                            <span className="text-2xl">🧑‍🎓</span>
                                        </div>
                                    </div>

                                    <h2 className="text-xl font-bold text-gray-800 mb-1.5">
                                        세션 시작을 기다리는 중{dots}
                                    </h2>
                                    <p className="text-sm text-gray-500 mb-8">
                                        호스트가 세션을 열면 자동으로 입장됩니다
                                    </p>

                                    {/* Info box */}
                                    <div className="bg-gray-50/80 rounded-2xl border border-gray-200/60 p-4 mb-6 text-left space-y-2.5">
                                        {[
                                            { label: '세션', value: roomName },
                                            { label: '호스트', value: hostName },
                                            { label: '내 닉네임', value: nickname },
                                            { label: '입장 코드', value: code, mono: true },
                                        ].map(row => (
                                            <div key={row.label} className="flex justify-between items-center text-sm">
                                                <span className="text-gray-400 font-medium">{row.label}</span>
                                                <span className={`font-semibold text-gray-800 ${row.mono ? 'font-mono tracking-widest text-blue-600' : ''}`}>
                                                    {row.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Timer */}
                                    <div className="flex items-center justify-center gap-2 mb-6">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-blink-dot" />
                                        <span className="text-sm text-gray-500">대기 중 · {formatElapsed(elapsed)}</span>
                                    </div>

                                    <button
                                        onClick={() => navigate('/')}
                                        className="w-full py-3 bg-gray-100 border border-gray-200 text-gray-500 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all"
                                    >
                                        ← 취소하고 나가기
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-xs text-gray-400 mt-6">© 2025 NeoLAB Convergence Inc.</p>
                </div>
            </div>
        </div>
    );
}
