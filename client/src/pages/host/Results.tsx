import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
    allowGuest?: boolean;
}

interface SessionResult {
    roomId: string;
    name: string;
    date: string;
    time: string;
    duration: number; // 분
    participants: number;
}

// 더미 종료 세션 데이터 (필기가 중요한 수업)
const DUMMY_COMPLETED_SESSIONS: SessionResult[] = [
    {
        roomId: 'session-1',
        name: '중등 수학 2-1 이차방정식 문제풀이',
        date: '2026-02-25',
        time: '14:00',
        duration: 60,
        participants: 18,
    },
    {
        roomId: 'session-2',
        name: '고등 영어 독해 - 수능 유형 분석',
        date: '2026-02-24',
        time: '16:00',
        duration: 50,
        participants: 22,
    },
    {
        roomId: 'session-3',
        name: '중학 과학 화학반응식 정리',
        date: '2026-02-23',
        time: '10:00',
        duration: 45,
        participants: 16,
    },
    {
        roomId: 'session-4',
        name: '한국사 근현대사 연표 암기',
        date: '2026-02-22',
        time: '15:00',
        duration: 55,
        participants: 20,
    },
    {
        roomId: 'session-5',
        name: '국어 문학 - 현대시 감상 및 필기',
        date: '2026-02-21',
        time: '13:00',
        duration: 50,
        participants: 19,
    },
];

export default function Results() {
    const navigate = useNavigate();
    const [results, setResults] = useState<SessionResult[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadResults();
    }, []);

    const loadResults = () => {
        try {
            const savedRooms = JSON.parse(localStorage.getItem('nc_rooms') || '[]') as Room[];

            // 종료된 세션만 필터링 (24시간 이상 경과한 세션)
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const completedSessions = savedRooms.filter(room =>
                room.createdAt < oneDayAgo && !room.isOpen
            );

            // SessionResult 형식으로 변환 (더미 데이터 추가)
            const sessionResults: SessionResult[] = completedSessions.map(room => {
                // 날짜/시간 파싱
                let date = '';
                let time = '';
                if (room.schedule) {
                    const parts = room.schedule.split(' ');
                    date = parts[0] || '';
                    time = parts[1] || '';
                }

                return {
                    roomId: room.roomId,
                    name: room.name,
                    date,
                    time,
                    duration: Math.floor(Math.random() * 60) + 30, // 더미: 30-90분
                    participants: Math.floor(Math.random() * 15) + 5, // 더미: 5-20명
                };
            });

            // 최신순 정렬
            const sorted = sessionResults.sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return dateB - dateA;
            });

            setResults(sorted);
        } catch (error) {
            console.error('수업 결과 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = (result: SessionResult) => {
        // 7단계에서 구현될 세션 상세 대시보드로 이동
        navigate(`/host/results/${result.roomId}`);
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
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">수업 결과</h1>
                <p className="text-gray-600">종료된 세션의 활동 기록을 확인합니다</p>
            </div>

            {/* 수업 결과 목록 */}
            {results.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-16 text-center">
                    <div className="mb-6">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-4xl">📊</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">종료된 세션이 없습니다</h3>
                        <p className="text-gray-500 text-sm">
                            세션 종료 후 수업 결과가 여기에 저장됩니다
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* 테이블 헤더 */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <div className="col-span-4 text-sm font-medium text-gray-700">세션명</div>
                        <div className="col-span-3 text-sm font-medium text-gray-700">날짜·시간</div>
                        <div className="col-span-2 text-sm font-medium text-gray-700">진행 시간</div>
                        <div className="col-span-2 text-sm font-medium text-gray-700">참여 인원</div>
                        <div className="col-span-1"></div>
                    </div>

                    {/* 결과 리스트 */}
                    <div className="divide-y divide-gray-100">
                        {results.map((result) => (
                            <div
                                key={result.roomId}
                                onClick={() => handleViewDetail(result)}
                                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50 cursor-pointer transition-colors"
                            >
                                {/* 세션명 */}
                                <div className="col-span-4 flex items-center">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-800 truncate">{result.name}</p>
                                    </div>
                                </div>

                                {/* 날짜·시간 */}
                                <div className="col-span-3 flex items-center">
                                    <p className="text-sm text-gray-600">
                                        {result.date} {result.time}
                                    </p>
                                </div>

                                {/* 진행 시간 */}
                                <div className="col-span-2 flex items-center">
                                    <p className="text-sm text-gray-800 font-medium">{result.duration}분</p>
                                </div>

                                {/* 참여 인원 */}
                                <div className="col-span-2 flex items-center">
                                    <p className="text-sm text-gray-800 font-medium">{result.participants}명</p>
                                </div>

                                {/* 화살표 */}
                                <div className="col-span-1 flex items-center justify-end">
                                    <svg
                                        className="w-5 h-5 text-gray-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 안내 정보 */}
            {results.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                    <div className="flex gap-3">
                        <span className="text-blue-600 text-xl flex-shrink-0">ℹ️</span>
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-blue-900 mb-1">수업 결과 안내</h4>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>• 세션을 클릭하면 상세 대시보드를 확인할 수 있습니다</li>
                                <li>• 학생별 활동 기록, 피드백, 참여 페이지 등을 확인하세요</li>
                                <li>• PDF 다운로드로 수업 결과를 저장할 수 있습니다</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
