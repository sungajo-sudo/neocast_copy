import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import watercolorBg from '../assets/watercolor-bg.png';

interface Room {
    roomId: string;
    name: string;
    schedule: string;
    maxGuests: number;
    code: string;
    isOpen: boolean;
    activeSessionId: string | null;
    createdAt: number;
}

type Tab = 'sessions' | 'reports' | 'settings';
type AiStatus = 'done' | 'pending' | 'none';

interface Archive {
    id: string;
    sessionName: string;
    round: number;
    date: string;
    studentCount: number;
    aiStatus: AiStatus;
}

const MOCK_ARCHIVES: Archive[] = [
    { id: 'a1', sessionName: '수학 월요일 오전반', round: 3, date: '2026.02.17', studentCount: 8, aiStatus: 'done' },
    { id: 'a2', sessionName: '수학 월요일 오전반', round: 2, date: '2026.02.10', studentCount: 7, aiStatus: 'done' },
    { id: 'a3', sessionName: '영어 화요일 오후반', round: 1, date: '2026.02.04', studentCount: 5, aiStatus: 'pending' },
    { id: 'a4', sessionName: '수학 월요일 오전반', round: 1, date: '2026.02.03', studentCount: 6, aiStatus: 'done' },
];

export default function HostHome() {
    const navigate = useNavigate();
    const { socketUrl, setSession } = useSessionStore();
    const API = socketUrl;

    const [nickname, setNickname] = useState(localStorage.getItem('nc_host_nickname') || '');
    const [hostId] = useState(() => {
        let id = localStorage.getItem('nc_host_id');
        if (!id) { id = `host_${Date.now()}`; localStorage.setItem('nc_host_id', id); }
        return id;
    });
    const [showNicknameModal, setShowNicknameModal] = useState(!nickname);
    const [nicknameInput, setNicknameInput] = useState('');

    // Tabs
    const [activeTab, setActiveTab] = useState<Tab>('sessions');

    // Session list
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newSchedule, setNewSchedule] = useState('');
    const [creating, setCreating] = useState(false);
    const [actionId, setActionId] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [password, setPassword] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
    const [createdRoom, setCreatedRoom] = useState<{ name: string; code: string } | null>(null);

    // Settings
    const [settingsNickname, setSettingsNickname] = useState(nickname);
    const [settingsSaved, setSettingsSaved] = useState(false);

    const fetchRooms = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/rooms?hostId=${hostId}`);
            if (res.ok) {
                const data = await res.json();
                // 열린 세션 먼저, 이후 최신순
                const sorted = (data.rooms as Room[]).sort(
                    (a, b) => (b.isOpen ? 1 : 0) - (a.isOpen ? 1 : 0) || b.createdAt - a.createdAt
                );
                setRooms(sorted);
            }
        } finally {
            setLoading(false);
        }
    }, [API, hostId]);

    useEffect(() => {
        if (nickname) fetchRooms();
        else setLoading(false);
    }, [nickname, fetchRooms]);

    function confirmNickname() {
        if (!nicknameInput.trim()) return;
        const n = nicknameInput.trim();
        localStorage.setItem('nc_host_nickname', n);
        setNickname(n);
        setSettingsNickname(n);
        setShowNicknameModal(false);
        setLoading(true);
    }

    async function createRoom() {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const res = await fetch(`${API}/api/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId, hostNickname: nickname, name: newName.trim(), schedule: newSchedule.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setCreatedRoom({ name: newName.trim(), code: data.room.code });
                setNewName(''); setNewSchedule('');
                await fetchRooms();
            }
        } finally {
            setCreating(false);
        }
    }

    async function openRoom(room: Room) {
        setActionId(room.roomId);
        try {
            const res = await fetch(`${API}/api/rooms/${room.roomId}/open`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname }),
            });
            if (res.ok) {
                const data = await res.json();
                setSession({ sessionId: data.sessionId, userId: data.userId, nickname, role: 'host', code: data.code });
                navigate('/session');
            }
        } finally {
            setActionId(null);
        }
    }

    async function closeRoom(room: Room, e: React.MouseEvent) {
        e.stopPropagation();
        setActionId(room.roomId);
        try {
            await fetch(`${API}/api/rooms/${room.roomId}/close`, { method: 'POST' });
            await fetchRooms();
        } finally {
            setActionId(null);
        }
    }

    async function deleteRoom(room: Room, e: React.MouseEvent) {
        e.stopPropagation();
        if (!confirm(`"${room.name}" 세션을 삭제할까요?`)) return;
        await fetch(`${API}/api/rooms/${room.roomId}`, { method: 'DELETE' });
        await fetchRooms();
    }

    function closeCreateModal() {
        setShowCreate(false);
        setCreatedRoom(null);
        setPassword(String(Math.floor(100000 + Math.random() * 900000)));
    }

    function copyCode(code: string, e: React.MouseEvent) {
        e.stopPropagation();
        navigator.clipboard.writeText(code).then(() => {
            setCopied(code);
            setTimeout(() => setCopied(null), 2000);
        });
    }

    function saveSettings() {
        const n = settingsNickname.trim();
        if (!n) return;
        localStorage.setItem('nc_host_nickname', n);
        setNickname(n);
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
    }

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'sessions', label: '세션 목록', icon: '📋' },
        { id: 'reports', label: '수업 결과', icon: '📊' },
        { id: 'settings', label: '설정', icon: '⚙️' },
    ];

    return (
        <div className="h-screen flex flex-col overflow-hidden font-sans relative">
            {/* Watercolor background */}
            <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60" style={{ backgroundImage: `url(${watercolorBg})` }} />
            <div className="absolute inset-0 z-0 bg-white/40 pointer-events-none" />

            {/* Header */}
            <header className="relative z-20 bg-white/70 backdrop-blur-md border-b border-white/50 px-6 shadow-sm flex-shrink-0 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center text-lg font-bold">
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
                        <span className="text-gray-800">CAST</span>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100/80 rounded-full px-2 py-0.5 border border-gray-200/50">호스트</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/join')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white/60 border border-gray-200 rounded-lg hover:bg-white hover:text-gray-800 transition-all"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        학생 입장
                    </button>

                    {nickname && (
                        <div className="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-3 py-1 border border-gray-200">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {nickname.charAt(0)}
                            </div>
                            <span className="text-xs text-gray-600 font-medium">{nickname}</span>
                        </div>
                    )}

                    {activeTab === 'sessions' && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            새 세션
                        </button>
                    )}
                </div>
            </header>

            {/* Tab bar */}
            <div className="relative z-10 bg-white/60 backdrop-blur-sm border-b border-white/50 px-6 flex-shrink-0">
                <div className="flex gap-0 max-w-6xl mx-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                                activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main */}
            <main className="flex-1 overflow-y-auto relative z-10 p-6 sm:p-8">
                <div className="max-w-6xl mx-auto">

                    {/* ── 세션 목록 탭 ── */}
                    {activeTab === 'sessions' && (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <h2 className="text-lg font-bold text-gray-800">📋 내 세션 목록</h2>
                                <span className="text-xs font-medium text-gray-500 bg-white/60 border border-white/50 rounded-full px-2.5 py-0.5">{rooms.length}개</span>
                            </div>

                            {loading ? (
                                <div className="flex flex-col items-center py-20 gap-4">
                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-gray-500 text-sm">불러오는 중...</p>
                                </div>
                            ) : rooms.length === 0 ? (
                                <div className="flex flex-col items-center py-20 gap-4 bg-white/50 backdrop-blur-sm rounded-3xl border border-white/60">
                                    <div className="text-5xl">📋</div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-gray-800 mb-1">아직 세션이 없어요</p>
                                        <p className="text-sm text-gray-500">세션을 만들면 고정 코드로 학생들이 언제나 입장할 수 있어요</p>
                                    </div>
                                    <button
                                        onClick={() => setShowCreate(true)}
                                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow"
                                    >
                                        + 첫 세션 만들기
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {rooms.map(room => (
                                        <div
                                            key={room.roomId}
                                            className={`relative bg-white/70 backdrop-blur-md rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md animate-fade-in
                                                ${room.isOpen
                                                    ? 'border-green-300/60 ring-1 ring-green-200/60 hover:-translate-y-0.5'
                                                    : 'border-white/60 hover:-translate-y-0.5'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                                                    ${room.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${room.isOpen ? 'bg-green-500 animate-blink-dot' : 'bg-gray-400'}`} />
                                                    {room.isOpen ? '진행 중 🟢' : '대기 중 ⚫'}
                                                </span>
                                                {!room.isOpen && (
                                                    <button
                                                        onClick={e => deleteRoom(room, e)}
                                                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                                                        title="세션 삭제"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>

                                            <h3 className="text-base font-bold text-gray-800 mb-0.5">{room.name}</h3>
                                            {room.schedule
                                                ? <p className="text-xs text-gray-400 mb-4">🕐 {room.schedule}</p>
                                                : <div className="mb-4" />
                                            }

                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="flex-1 bg-blue-50/80 border border-blue-100 rounded-xl px-3 py-2">
                                                    <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wide mb-0.5">입장 코드</p>
                                                    <p className="text-xl font-bold text-blue-700 tracking-[0.25em] font-mono">{room.code}</p>
                                                </div>
                                                <button
                                                    onClick={e => copyCode(room.code, e)}
                                                    className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-all"
                                                    title="코드 복사"
                                                >
                                                    {copied === room.code ? (
                                                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="flex gap-2">
                                                {room.isOpen ? (
                                                    <>
                                                        <button
                                                            onClick={() => openRoom(room)}
                                                            disabled={actionId === room.roomId}
                                                            className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 transition-all"
                                                        >
                                                            {actionId === room.roomId ? '처리 중...' : '▶ 세션 입장'}
                                                        </button>
                                                        <button
                                                            onClick={e => closeRoom(room, e)}
                                                            disabled={actionId === room.roomId}
                                                            className="flex-1 py-2.5 bg-red-50 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 disabled:opacity-60 transition-all"
                                                        >
                                                            ■ 세션 종료
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => openRoom(room)}
                                                        disabled={actionId === room.roomId}
                                                        className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-60 transition-all shadow-sm"
                                                    >
                                                        {actionId === room.roomId ? '열고 있어요...' : '▶ 세션 열기'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ── 수업 결과 탭 ── */}
                    {activeTab === 'reports' && (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <h2 className="text-lg font-bold text-gray-800">📊 수업 결과</h2>
                                <span className="text-xs font-medium text-gray-500 bg-white/60 border border-white/50 rounded-full px-2.5 py-0.5">{MOCK_ARCHIVES.length}회차</span>
                            </div>

                            <div className="space-y-3">
                                {MOCK_ARCHIVES.map(archive => (
                                    <div
                                        key={archive.id}
                                        className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-5 flex items-center gap-4 animate-fade-in"
                                    >
                                        {/* 회차 번호 */}
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                                            <span className="text-white font-bold text-sm">{archive.round}회</span>
                                        </div>

                                        {/* 정보 */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-800 truncate">{archive.sessionName}</p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-xs text-gray-400">{archive.date}</span>
                                                <span className="text-xs text-gray-400">학생 {archive.studentCount}명</span>
                                            </div>
                                        </div>

                                        {/* AI 상태 배지 */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            {archive.aiStatus === 'done' && (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 rounded-full px-2.5 py-1">
                                                    ✅ 분석 완료
                                                </span>
                                            )}
                                            {archive.aiStatus === 'pending' && (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full px-2.5 py-1">
                                                    ⏳ 분석 중
                                                </span>
                                            )}
                                            {archive.aiStatus === 'none' && (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
                                                    미생성
                                                </span>
                                            )}
                                            <button
                                                disabled={archive.aiStatus !== 'done'}
                                                onClick={() => archive.aiStatus === 'done' && navigate(`/report/${archive.id}`)}
                                                className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:from-blue-700 hover:to-indigo-700 transition-all"
                                            >
                                                AI 분석 보기
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-6 text-center text-xs text-gray-400">
                                * 현재 목업 데이터입니다. AI 분석 기능은 준비 중입니다.
                            </p>
                        </>
                    )}

                    {/* ── 설정 탭 ── */}
                    {activeTab === 'settings' && (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <h2 className="text-lg font-bold text-gray-800">⚙️ 설정</h2>
                            </div>

                            <div className="max-w-lg space-y-4">
                                {/* 프로필명 */}
                                <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-6 animate-fade-in">
                                    <h3 className="text-sm font-bold text-gray-700 mb-4">프로필</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">선생님 이름</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={settingsNickname}
                                                    onChange={e => setSettingsNickname(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && saveSettings()}
                                                    maxLength={20}
                                                    className="flex-1 px-4 py-2.5 bg-white/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-gray-800 text-sm transition-all"
                                                />
                                                <button
                                                    onClick={saveSettings}
                                                    disabled={!settingsNickname.trim() || settingsNickname.trim() === nickname}
                                                    className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                >
                                                    {settingsSaved ? '✓ 저장됨' : '저장'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 비밀번호 (준비 중) */}
                                <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-6 opacity-60 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-700">비밀번호 변경</h3>
                                            <p className="text-xs text-gray-400 mt-0.5">계정 보안 설정</p>
                                        </div>
                                        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">준비 중</span>
                                    </div>
                                </div>

                                {/* 언어 (준비 중) */}
                                <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-6 opacity-60 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-700">언어</h3>
                                            <p className="text-xs text-gray-400 mt-0.5">한국어</p>
                                        </div>
                                        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">준비 중</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* ─── 닉네임 설정 모달 (최초 진입 시) ─── */}
            {showNicknameModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-8 animate-fade-in">
                        <div className="text-center mb-6">
                            <div className="text-4xl mb-3">👩‍🏫</div>
                            <h3 className="text-xl font-bold text-gray-800">NeoCast에 오신 것을 환영해요</h3>
                            <p className="text-sm text-gray-500 mt-1">선생님의 이름을 입력해주세요</p>
                        </div>
                        <input
                            type="text"
                            value={nicknameInput}
                            onChange={e => setNicknameInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && confirmNickname()}
                            placeholder="예: 김선생님"
                            autoFocus
                            maxLength={20}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-400 text-gray-800 text-center text-lg font-semibold mb-4"
                        />
                        <button
                            onClick={confirmNickname}
                            disabled={!nicknameInput.trim()}
                            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-base hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 transition-all shadow"
                        >
                            시작하기 →
                        </button>
                    </div>
                </div>
            )}

            {/* ─── 새 세션 생성 모달 ─── */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={!createdRoom ? closeCreateModal : undefined}>
                    <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-8 animate-fade-in" onClick={e => e.stopPropagation()}>

                        {createdRoom ? (
                            /* ── 완료 뷰 ── */
                            <>
                                <div className="text-center mb-6">
                                    <div className="text-4xl mb-3">🎉</div>
                                    <h3 className="text-xl font-bold text-gray-800">세션이 만들어졌어요!</h3>
                                    <p className="text-sm text-gray-500 mt-1">{createdRoom.name}</p>
                                </div>

                                <div className="space-y-3 mb-6">
                                    {/* 입장 코드 */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">입장 코드</label>
                                        <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-100 rounded-xl px-4 py-3">
                                            <span className="flex-1 text-2xl font-bold text-blue-700 tracking-[0.3em] font-mono">{createdRoom.code}</span>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(createdRoom.code); setCopied('code'); setTimeout(() => setCopied(null), 2000); }}
                                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                {copied === 'code' ? '✓ 복사됨' : '복사'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* 초대 링크 */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">초대 링크</label>
                                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                                            <span className="flex-1 text-xs text-gray-600 truncate font-mono">
                                                {`${window.location.origin}/join?code=${createdRoom.code}`}
                                            </span>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join?code=${createdRoom.code}`); setCopied('link'); setTimeout(() => setCopied(null), 2000); }}
                                                className="px-3 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors shrink-0"
                                            >
                                                {copied === 'link' ? '✓ 복사됨' : '복사'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={closeCreateModal} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow">
                                    확인
                                </button>
                            </>
                        ) : (
                            /* ── 폼 뷰 ── */
                            <>
                                <h3 className="text-xl font-bold text-gray-800 mb-6">📋 새 세션 만들기</h3>
                                <div className="space-y-4">
                                    {/* 세션 이름 */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            세션 이름 <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && createRoom()}
                                            placeholder="예: 수학 월요일 오전반"
                                            autoFocus
                                            maxLength={40}
                                            className="w-full px-4 py-3 bg-white/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-400 text-gray-800"
                                        />
                                    </div>

                                    {/* 수업 일정 */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            수업 일정 <span className="text-gray-400 font-normal text-xs">(선택)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newSchedule}
                                            onChange={e => setNewSchedule(e.target.value)}
                                            placeholder="예: 매주 월 09:00 ~ 10:30"
                                            maxLength={40}
                                            className="w-full px-4 py-3 bg-white/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-400 text-gray-800"
                                        />
                                    </div>

                                    {/* 입장 비밀번호 */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            입장 비밀번호 <span className="text-gray-400 font-normal text-xs">(자동 생성)</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 flex items-center px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                                                <span className="flex-1 text-xl font-bold text-amber-700 tracking-[0.2em] font-mono">{password}</span>
                                            </div>
                                            <button
                                                onClick={() => setPassword(String(Math.floor(100000 + Math.random() * 900000)))}
                                                className="px-3 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-amber-600 hover:border-amber-300 transition-all"
                                                title="비밀번호 재생성"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button onClick={closeCreateModal} className="flex-1 py-3 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all">취소</button>
                                    <button
                                        onClick={createRoom}
                                        disabled={creating || !newName.trim()}
                                        className="flex-[2] py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow"
                                    >
                                        {creating ? '만드는 중...' : '세션 만들기'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
