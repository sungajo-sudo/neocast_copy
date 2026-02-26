import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { generateStudentReportPDF } from '../../utils/pdfGenerator';
import { getStudentDetailData } from '../../data/dummyStudentData';

interface StudentData {
    id: string;
    name: string;
    activityTime: number; // 분
    participatedPages: number;
    feedbackCount: number;
    hasNoActivity: boolean;
}

// 더미 학생 데이터
const DUMMY_STUDENTS: StudentData[] = [
    { id: 's1', name: '김민지', activityTime: 45, participatedPages: 8, feedbackCount: 3, hasNoActivity: false },
    { id: 's2', name: '이서준', activityTime: 38, participatedPages: 7, feedbackCount: 2, hasNoActivity: false },
    { id: 's3', name: '박지우', activityTime: 52, participatedPages: 10, feedbackCount: 4, hasNoActivity: false },
    { id: 's4', name: '최수아', activityTime: 0, participatedPages: 0, feedbackCount: 0, hasNoActivity: true },
    { id: 's5', name: '정현우', activityTime: 41, participatedPages: 9, feedbackCount: 3, hasNoActivity: false },
    { id: 's6', name: '강예린', activityTime: 0, participatedPages: 0, feedbackCount: 0, hasNoActivity: true },
    { id: 's7', name: '윤도현', activityTime: 47, participatedPages: 8, feedbackCount: 2, hasNoActivity: false },
    { id: 's8', name: '한소민', activityTime: 44, participatedPages: 9, feedbackCount: 3, hasNoActivity: false },
];

export default function SessionDetail() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [sessionName, setSessionName] = useState('수학 중간고사 대비반');
    const [sessionDate, setSessionDate] = useState('2026-02-25');

    // 요약 데이터 계산
    const totalDuration = 60; // 진행 시간 (분)
    const totalStudents = DUMMY_STUDENTS.length;
    const activeStudents = DUMMY_STUDENTS.filter(s => !s.hasNoActivity);
    const avgActivityTime = Math.round(
        activeStudents.reduce((sum, s) => sum + s.activityTime, 0) / activeStudents.length
    );
    const avgPages = Math.round(
        activeStudents.reduce((sum, s) => sum + s.participatedPages, 0) / activeStudents.length
    );
    const noActivityStudents = DUMMY_STUDENTS.filter(s => s.hasNoActivity);

    // 차트용 최대값
    const maxActivityTime = Math.max(...DUMMY_STUDENTS.map(s => s.activityTime));

    const handleViewStudentDetail = (studentId: string) => {
        navigate(`/host/results/${sessionId}/student/${studentId}`);
    };

    const handleDownloadPDF = async (studentId: string, studentName: string) => {
        try {
            // 해당 학생 데이터 찾기
            const student = DUMMY_STUDENTS.find(s => s.id === studentId);
            if (!student) {
                alert('학생 데이터를 찾을 수 없습니다.');
                return;
            }

            // 공유 데이터 소스에서 학생 상세 데이터 가져오기
            const studentData = getStudentDetailData(studentId, studentName, student.participatedPages);

            // PDF 생성 (StudentReportDetail과 동일한 데이터 사용)
            await generateStudentReportPDF({
                studentName: studentData.info.name,
                sessionName,
                sessionDate,
                activityTime: studentData.info.activityTime,
                participatedPages: studentData.info.participatedPages,
                feedbackCount: studentData.info.feedbackCount,
                pageParticipation: studentData.pageParticipation,
            });
        } catch (error) {
            console.error('PDF 생성 실패:', error);
            alert('PDF 생성 중 오류가 발생했습니다.');
        }
    };

    useEffect(() => {
        // sessionId로 실제 세션 정보 로드
        // 임시로 더미 데이터 사용
    }, [sessionId]);

    return (
        <div className="p-8">
            {/* 헤더 */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/host/results')}
                    className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
                >
                    ← 목록으로
                </button>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">{sessionName}</h1>
                <p className="text-gray-600">{sessionDate}</p>
            </div>

            {/* 상단 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">진행 시간</p>
                    <p className="text-3xl font-bold text-blue-600">{totalDuration}분</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">참여 학생 수</p>
                    <p className="text-3xl font-bold text-purple-600">{totalStudents}명</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">평균 활동 시간</p>
                    <p className="text-3xl font-bold text-green-600">{avgActivityTime}분</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">평균 참여 페이지 수</p>
                    <p className="text-3xl font-bold text-orange-600">{avgPages}개</p>
                </div>
            </div>

            {/* 차트 영역 */}
            <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-6">학생별 활동 시간</h2>
                <div className="space-y-4">
                    {DUMMY_STUDENTS.map((student) => (
                        <div key={student.id} className="flex items-center gap-4">
                            {/* 학생명 */}
                            <div className="w-24 flex-shrink-0">
                                <p className="text-sm font-medium text-gray-700">{student.name}</p>
                            </div>

                            {/* 막대 그래프 */}
                            <div className="flex-1 flex items-center gap-3">
                                <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                                    {student.activityTime > 0 && (
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full flex items-center justify-end pr-3"
                                            style={{
                                                width: `${(student.activityTime / maxActivityTime) * 100}%`,
                                            }}
                                        >
                                            <span className="text-white text-xs font-bold">
                                                {student.activityTime}분
                                            </span>
                                        </div>
                                    )}
                                    {student.activityTime === 0 && (
                                        <div className="flex items-center justify-center h-full">
                                            <span className="text-gray-400 text-xs">활동 없음</span>
                                        </div>
                                    )}
                                </div>

                                {/* 참여 페이지 수 */}
                                <div className="w-20 text-right">
                                    <span className="text-sm text-gray-600">
                                        {student.participatedPages}페이지
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 학생 테이블 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800">학생 목록</h2>
                </div>

                {/* 테이블 헤더 */}
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="col-span-2 text-sm font-medium text-gray-700">학생명</div>
                    <div className="col-span-2 text-sm font-medium text-gray-700">활동 시간</div>
                    <div className="col-span-2 text-sm font-medium text-gray-700">참여 페이지 수</div>
                    <div className="col-span-2 text-sm font-medium text-gray-700">피드백(첨삭) 수</div>
                    <div className="col-span-2 text-sm font-medium text-gray-700">상세</div>
                    <div className="col-span-2 text-sm font-medium text-gray-700">PDF</div>
                </div>

                {/* 학생 리스트 */}
                <div className="divide-y divide-gray-100">
                    {DUMMY_STUDENTS.map((student) => (
                        <div
                            key={student.id}
                            className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                        >
                            {/* 학생명 */}
                            <div className="col-span-2 flex items-center">
                                <p className="font-medium text-gray-800">{student.name}</p>
                            </div>

                            {/* 활동 시간 */}
                            <div className="col-span-2 flex items-center">
                                <p className={`text-sm ${student.activityTime === 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                    {student.activityTime}분
                                </p>
                            </div>

                            {/* 참여 페이지 수 */}
                            <div className="col-span-2 flex items-center">
                                <p className="text-sm text-gray-800">{student.participatedPages}개</p>
                            </div>

                            {/* 피드백 수 */}
                            <div className="col-span-2 flex items-center">
                                <p className="text-sm text-gray-800">{student.feedbackCount}개</p>
                            </div>

                            {/* 상세 버튼 */}
                            <div className="col-span-2 flex items-center">
                                <button
                                    onClick={() => handleViewStudentDetail(student.id)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    상세 보기
                                </button>
                            </div>

                            {/* PDF 다운로드 */}
                            <div className="col-span-2 flex items-center">
                                <button
                                    onClick={() => handleDownloadPDF(student.id, student.name)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                                >
                                    PDF 다운로드
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* AI 리포트 영역 */}
            {noActivityStudents.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8">
                    <div className="flex items-start gap-4 mb-6">
                        <span className="text-3xl">⚠️</span>
                        <div>
                            <h2 className="text-xl font-bold text-orange-900 mb-2">
                                활동이 감지되지 않은 학생
                            </h2>
                            <p className="text-sm text-orange-800">
                                아래 학생들은 세션 중 활동 기록이 없습니다. 개별 확인이 필요할 수 있습니다.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {noActivityStudents.map((student) => (
                            <div
                                key={student.id}
                                className="bg-white rounded-xl p-4 border border-orange-200"
                            >
                                <p className="font-medium text-gray-800 mb-1">{student.name}</p>
                                <p className="text-xs text-gray-600">활동 시간: 0분</p>
                                <p className="text-xs text-gray-600">참여 페이지: 0개</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 p-4 bg-white rounded-xl border border-orange-200">
                        <p className="text-sm text-orange-900">
                            💡 <strong>안내:</strong> 이 리포트는 수업 종료 후 자동으로 생성되며,
                            수업 중에는 방해하지 않습니다. 활동 기록이 없는 학생은 기기 연결 문제나
                            개인적인 사정이 있을 수 있으니 개별적으로 확인해보세요.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
