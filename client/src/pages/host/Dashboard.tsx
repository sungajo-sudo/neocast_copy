import { useState } from 'react';
import { Link } from 'react-router-dom';

// 더미 세션 데이터
const DUMMY_SESSIONS = [
    {
        id: '1',
        title: '수학 중간고사 대비반',
        date: '2026-02-26',
        time: '14:00',
        instructor: '김민수',
        expectedStudents: 20,
        actualStudents: 18,
        worksheet: '중간고사_문제지.pdf',
        status: 'scheduled' as const,
        code: 'ABC123',
    },
    {
        id: '2',
        title: '영어 회화 실습',
        date: '2026-02-26',
        time: '16:00',
        instructor: '이영희',
        expectedStudents: 15,
        actualStudents: 15,
        worksheet: null,
        status: 'in-progress' as const,
        code: 'DEF456',
    },
    {
        id: '3',
        title: '과학 실험 수업',
        date: '2026-02-27',
        time: '10:00',
        instructor: '박철수',
        expectedStudents: 25,
        actualStudents: 0,
        worksheet: '실험_가이드.pdf',
        status: 'scheduled' as const,
        code: 'GHI789',
    },
    {
        id: '4',
        title: '역사 토론 세션',
        date: '2026-02-27',
        time: '15:00',
        instructor: '최지원',
        expectedStudents: 12,
        actualStudents: 0,
        worksheet: null,
        status: 'scheduled' as const,
        code: 'JKL012',
    },
    {
        id: '5',
        title: '미술 작품 감상',
        date: '2026-02-28',
        time: '13:00',
        instructor: '정수연',
        expectedStudents: 18,
        actualStudents: 0,
        worksheet: '작품_목록.pdf',
        status: 'scheduled' as const,
        code: 'MNO345',
    },
];

export default function Dashboard() {
    const [filterTab, setFilterTab] = useState<'today' | 'upcoming'>('today');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const nickname = localStorage.getItem('nc_host_nickname') || '선생님';

    // 필터링된 세션
    const today = new Date().toISOString().split('T')[0];
    const filteredSessions = DUMMY_SESSIONS.filter((session) => {
        if (filterTab === 'today') {
            return session.date === today;
        } else {
            return session.date >= today;
        }
    }).slice(0, 5);

    const handleStartSession = (code: string) => {
        alert(`세션 시작: ${code}\n(다음 단계에서 세션 만들기 모달과 연결됩니다)`);
    };

    const handleEdit = (id: string) => {
        alert(`세션 수정: ${id}\n(다음 단계에서 구현됩니다)`);
        setOpenMenuId(null);
    };

    const handleDelete = (id: string) => {
        if (confirm('이 세션을 삭제하시겠습니까?')) {
            alert(`세션 삭제: ${id}\n(다음 단계에서 구현됩니다)`);
            setOpenMenuId(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* 상단 인사 영역 */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    안녕하세요, {nickname}님!
                </h1>
                <p className="text-gray-600">오늘도 스마트한 수업을 시작해볼까요?</p>
            </div>

            {/* 카드 영역 (2컬럼) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* 좌측: 새 세션 시작 카드 */}
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold">새 세션 시작</h2>
                        <button
                            onClick={() => alert('세션 만들기 모달 열기 (3단계에서 구현)')}
                            className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-3xl transition-colors"
                        >
                            +
                        </button>
                    </div>
                    <p className="text-white/90 text-sm">
                        즉시 수업을 시작하거나 교재를 업로드하여 세션을 준비하세요
                    </p>
                </div>

                {/* 우측: 요약 대시보드 */}
                <div className="bg-white rounded-2xl shadow-sm p-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-6">요약 대시보드</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">진행 예정</span>
                            <span className="text-2xl font-bold text-blue-600">
                                {DUMMY_SESSIONS.filter((s) => s.status === 'scheduled').length} sessions
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">평균 활동 시간</span>
                            <span className="text-2xl font-bold text-purple-600">45분</span>
                        </div>
                    </div>
                    <Link
                        to="/host/results"
                        className="mt-6 inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        상세 학습 데이터 리포트 보기 →
                    </Link>
                </div>
            </div>

            {/* 세션 목록 영역 */}
            <div className="bg-white rounded-2xl shadow-sm p-8">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800">세션 목록</h2>

                    {/* 필터 탭 */}
                    <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setFilterTab('today')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                filterTab === 'today'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            오늘
                        </button>
                        <button
                            onClick={() => setFilterTab('upcoming')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                filterTab === 'upcoming'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            예정된 세션
                        </button>
                    </div>
                </div>

                {/* 세션 리스트 */}
                {filteredSessions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        {filterTab === 'today' ? '오늘 예정된 세션이 없습니다.' : '예정된 세션이 없습니다.'}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredSessions.map((session) => (
                            <div
                                key={session.id}
                                className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
                            >
                                {/* 시간 */}
                                <div className="flex-shrink-0 text-center">
                                    <div className="text-xs text-gray-500">{session.date}</div>
                                    <div className="text-lg font-bold text-gray-800">{session.time}</div>
                                </div>

                                {/* 세부 정보 */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-800 mb-1 truncate">{session.title}</h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span>강사: {session.instructor}</span>
                                        {session.worksheet && (
                                            <span className="flex items-center gap-1">
                                                📄 {session.worksheet}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 상태 뱃지 */}
                                <div className="flex-shrink-0">
                                    {session.status === 'scheduled' && (
                                        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                                            예정
                                        </span>
                                    )}
                                    {session.status === 'in-progress' && (
                                        <span className="px-3 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                                            진행중
                                        </span>
                                    )}
                                </div>

                                {/* 시작 버튼 */}
                                <button
                                    onClick={() => handleStartSession(session.code)}
                                    className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    시작
                                </button>

                                {/* 더보기 메뉴 */}
                                <div className="relative flex-shrink-0">
                                    <button
                                        onClick={() => setOpenMenuId(openMenuId === session.id ? null : session.id)}
                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        ⋯
                                    </button>

                                    {/* 드롭다운 메뉴 */}
                                    {openMenuId === session.id && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setOpenMenuId(null)}
                                            />
                                            <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                                <button
                                                    onClick={() => handleEdit(session.id)}
                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                                >
                                                    수정
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(session.id)}
                                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
