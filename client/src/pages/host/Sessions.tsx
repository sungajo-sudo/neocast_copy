import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateSessionModal from '../../components/modals/CreateSessionModal';
import { useSessionStore } from '../../stores/sessionStore';

interface Room {
    roomId: string;
    name: string;
    schedule: string;
    maxGuests: number;
    code: string;
    isOpen: boolean;
    activeSessionId: string | null;
    createdAt: number;
    expectedStudents?: number;
    worksheet?: string;
    worksheetId?: string;
    allowGuest?: boolean;
}

type SessionStatus = 'scheduled' | 'in-progress' | 'completed';

export default function Sessions() {
    const navigate = useNavigate();
    const { setSession } = useSessionStore();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const hostId = localStorage.getItem('nc_host_id') || '';
    const nickname = localStorage.getItem('nc_host_nickname') || '선생님';

    // 세션 목록 불러오기
    const fetchRooms = useCallback(() => {
        try {
            const savedRooms = JSON.parse(localStorage.getItem('nc_rooms') || '[]') as Room[];
            // 등록일 최신순 정렬
            const sorted = savedRooms.sort((a, b) => b.createdAt - a.createdAt);
            setRooms(sorted);
        } catch (error) {
            console.error('세션 목록 불러오기 실패:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    // 세션 상태 판별
    const getSessionStatus = (room: Room): SessionStatus => {
        if (room.isOpen) return 'in-progress';
        // 종료된 세션 판별 로직 (임시: 생성된지 24시간 이상 지난 세션)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (room.createdAt < oneDayAgo && !room.isOpen) return 'completed';
        return 'scheduled';
    };

    // 코드 복사
    const handleCopyCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(code);
            setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.error('복사 실패:', err);
        }
    };

    // 세션 시작 (dev 세션 입장 로직)
    const handleStartSession = async (room: Room) => {
        try {
            // 세션 정보 생성
            const sessionId = room.activeSessionId || `session-${Date.now()}`;
            const userId = hostId;

            // localStorage 업데이트: 세션 열림 상태로 변경
            const savedRooms = JSON.parse(localStorage.getItem('nc_rooms') || '[]') as Room[];
            const updatedRooms = savedRooms.map(r =>
                r.roomId === room.roomId ? { ...r, isOpen: true, activeSessionId: sessionId } : r
            );
            localStorage.setItem('nc_rooms', JSON.stringify(updatedRooms));

            // 워크시트가 연결된 세션이면 PDF 배경 로드용 key 저장
            if (room.worksheetId) {
                localStorage.setItem(`nc_session_worksheet_${sessionId}`, room.worksheetId);
            }

            // sessionStore에 저장
            setSession({ sessionId, userId, nickname, role: 'host', code: room.code });

            // 세션 화면으로 이동
            navigate('/session');
        } catch (error) {
            console.error('세션 시작 실패:', error);
            alert('세션 시작에 실패했습니다.');
        }
    };

    // 세션 수정
    const handleEdit = (room: Room) => {
        alert(`세션 수정: ${room.name}\n(다음 단계에서 구현됩니다)`);
        setOpenMenuId(null);
    };

    // 세션 삭제
    const handleDelete = (room: Room) => {
        if (!confirm(`"${room.name}" 세션을 삭제하시겠습니까?`)) return;

        try {
            const savedRooms = JSON.parse(localStorage.getItem('nc_rooms') || '[]') as Room[];
            const filtered = savedRooms.filter(r => r.roomId !== room.roomId);
            localStorage.setItem('nc_rooms', JSON.stringify(filtered));
            fetchRooms();
            setOpenMenuId(null);
        } catch (error) {
            console.error('세션 삭제 실패:', error);
            alert('세션 삭제에 실패했습니다.');
        }
    };

    // 세션 생성 완료 핸들러
    const handleSessionCreated = () => {
        fetchRooms(); // 목록 새로고침
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="flex items-center justify-center h-64">
                    <p className="text-gray-500">로딩중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-800">세션 목록</h1>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                    <span className="text-xl">+</span>
                    세션 만들기
                </button>
            </div>

            {/* 세션 목록 */}
            {rooms.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-16 text-center">
                    <p className="text-gray-500 mb-6">생성된 세션이 없습니다.</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                    >
                        <span className="text-xl">+</span>
                        첫 세션 만들기
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {rooms.map((room) => {
                        const status = getSessionStatus(room);
                        const actualStudents = 0; // 실제 참가자 수 (추후 구현)

                        return (
                            <div
                                key={room.roomId}
                                className="bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                            >
                                {/* 카드 헤더 */}
                                <div className="p-6 border-b border-gray-100">
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="text-xl font-bold text-gray-800 flex-1 pr-4">
                                            {room.name}
                                        </h3>

                                        {/* 더보기 메뉴 */}
                                        <div className="relative flex-shrink-0">
                                            <button
                                                onClick={() => setOpenMenuId(openMenuId === room.roomId ? null : room.roomId)}
                                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                ⋯
                                            </button>

                                            {openMenuId === room.roomId && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onClick={() => setOpenMenuId(null)}
                                                    />
                                                    <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                                        <button
                                                            onClick={() => handleEdit(room)}
                                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                                        >
                                                            수정
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(room)}
                                                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* 날짜·시간 */}
                                    <p className="text-sm text-gray-600 mb-3">
                                        📅 {room.schedule || '날짜 미정'}
                                    </p>

                                    {/* 워크시트 */}
                                    {room.worksheet && (
                                        <div className="flex items-center gap-2 mb-3">
                                            {room.worksheetId && localStorage.getItem(`nc_ws_thumb_${room.worksheetId}`) ? (
                                                <img
                                                    src={localStorage.getItem(`nc_ws_thumb_${room.worksheetId}`)!}
                                                    alt="썸네일"
                                                    className="w-8 h-10 object-cover rounded border border-gray-200 flex-shrink-0"
                                                />
                                            ) : (
                                                <span className="text-blue-600">📄</span>
                                            )}
                                            <span className="text-sm text-blue-600 truncate">{room.worksheet}</span>
                                        </div>
                                    )}

                                    {/* 참가자 수 */}
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-gray-600">
                                            참가자: <span className="font-bold text-gray-800">{actualStudents}</span>
                                            {room.expectedStudents && (
                                                <span className="text-gray-400"> / {room.expectedStudents}명</span>
                                            )}
                                        </span>
                                        {room.expectedStudents && actualStudents > 0 && (
                                            <span className="text-blue-600 font-medium">
                                                {Math.round((actualStudents / room.expectedStudents) * 100)}%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 카드 푸터 */}
                                <div className="p-6 bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* 상태 뱃지 */}
                                        {status === 'scheduled' && (
                                            <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">
                                                예정
                                            </span>
                                        )}
                                        {status === 'in-progress' && (
                                            <span className="px-3 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                                                진행중
                                            </span>
                                        )}
                                        {status === 'completed' && (
                                            <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                                                종료
                                            </span>
                                        )}

                                        {/* 코드 */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 font-mono">{room.code}</span>
                                            <button
                                                onClick={() => handleCopyCode(room.code)}
                                                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
                                                title="코드 복사"
                                            >
                                                {copied === room.code ? '✓' : '📋'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* 시작 버튼 */}
                                    {status !== 'completed' && (
                                        <button
                                            onClick={() => handleStartSession(room)}
                                            className={`px-6 py-2 font-medium rounded-lg transition-colors ${
                                                status === 'in-progress'
                                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                        >
                                            {status === 'in-progress' ? '다시 입장' : '시작'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 세션 만들기 모달 */}
            <CreateSessionModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={(code) => {
                    console.log('세션 생성 완료:', code);
                    handleSessionCreated();
                }}
            />
        </div>
    );
}
