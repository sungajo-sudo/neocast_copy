import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getStudentDetailData, type StudentInfo, type Feedback, type PageParticipation } from '../../data/dummyStudentData';

export default function StudentReportDetail() {
    const { sessionId, studentId } = useParams();
    const navigate = useNavigate();

    // 학생 데이터 로드 (공유 데이터 사용)
    const studentData = getStudentDetailData(studentId || 's1', '학생', 8);
    const [studentInfo] = useState<StudentInfo>(studentData.info);
    const [feedbacks] = useState<Feedback[]>(studentData.feedbacks);
    const [pageParticipation] = useState<PageParticipation[]>(studentData.pageParticipation);

    // 필기 재생 플레이어 상태 (UI만)
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const maxTime = 60 * 60; // 60분 (초 단위)

    useEffect(() => {
        // 실제로는 sessionId와 studentId로 데이터 로드
        // 지금은 더미 데이터 사용
    }, [sessionId, studentId]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
        // 실제 재생 로직은 Step 9에서 구현
    };

    const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentTime(parseInt(e.target.value));
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
    };

    return (
        <div className="p-8">
            {/* 헤더 - 뒤로가기 */}
            <button
                onClick={() => navigate(`/host/results/${sessionId}`)}
                className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
            >
                ← 세션 대시보드로
            </button>

            {/* 학생 정보 헤더 */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">{studentInfo.name} 학생 리포트</h1>

                {/* 요약 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">총 활동 시간</p>
                        <p className="text-3xl font-bold text-blue-600">{studentInfo.activityTime}분</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">참여 페이지 수</p>
                        <p className="text-3xl font-bold text-purple-600">{studentInfo.participatedPages}개</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">받은 피드백</p>
                        <p className="text-3xl font-bold text-green-600">{studentInfo.feedbackCount}개</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">평균 필기 밀도</p>
                        <p className="text-3xl font-bold text-orange-600">
                            {Math.round(pageParticipation.reduce((sum, p) => sum + p.strokeCount, 0) / pageParticipation.length)}획
                        </p>
                    </div>
                </div>
            </div>

            {/* 필기 재생 플레이어 */}
            <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-6">필기 재생 플레이어</h2>

                {/* 플레이어 영역 */}
                <div className="bg-gray-100 rounded-xl p-8 mb-6 flex items-center justify-center" style={{ minHeight: '300px' }}>
                    <div className="text-center">
                        <div className="text-6xl mb-4">▶️</div>
                        <p className="text-gray-600">재생 기능은 Step 9에서 구현됩니다</p>
                        <p className="text-sm text-gray-500 mt-2">학생의 필기 과정을 시간순으로 재생합니다</p>
                    </div>
                </div>

                {/* 컨트롤 바 */}
                <div className="space-y-4">
                    {/* 타임라인 */}
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700 w-12">{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            min="0"
                            max={maxTime}
                            value={currentTime}
                            onChange={handleTimelineChange}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-sm text-gray-500 w-12">{formatTime(maxTime)}</span>
                    </div>

                    {/* 재생 컨트롤 */}
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={handlePlayPause}
                            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center text-xl transition-colors"
                        >
                            {isPlaying ? '⏸' : '▶'}
                        </button>

                        {/* 배속 조절 */}
                        <div className="flex items-center gap-2 ml-8">
                            <span className="text-sm text-gray-600 mr-2">재생 속도:</span>
                            {[0.5, 1, 1.5, 2].map((speed) => (
                                <button
                                    key={speed}
                                    onClick={() => handleSpeedChange(speed)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                        playbackSpeed === speed
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {speed}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 피드백 다시보기 */}
            <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-6">받은 피드백 ({feedbacks.length})</h2>

                {feedbacks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <p>아직 받은 피드백이 없습니다</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {feedbacks.map((feedback) => (
                            <div
                                key={feedback.id}
                                className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all"
                            >
                                {/* 첨삭 이미지 */}
                                <div className="aspect-[4/3] bg-gray-100">
                                    <img
                                        src={feedback.imageUrl}
                                        alt={`페이지 ${feedback.pageNumber} 첨삭`}
                                        className="w-full h-full object-contain"
                                    />
                                </div>

                                {/* 정보 */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-blue-600">
                                            페이지 {feedback.pageNumber}
                                        </span>
                                        <span className="text-xs text-gray-500">{feedback.timestamp}</span>
                                    </div>
                                    {feedback.comment && (
                                        <p className="text-sm text-gray-700">{feedback.comment}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 페이지별 참여 요약 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800">페이지별 참여 요약</h2>
                </div>

                {/* 테이블 헤더 */}
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="col-span-2 text-sm font-medium text-gray-700">페이지</div>
                    <div className="col-span-2 text-sm font-medium text-gray-700">필기 시간</div>
                    <div className="col-span-2 text-sm font-medium text-gray-700">획 수</div>
                    <div className="col-span-3 text-sm font-medium text-gray-700">첫 필기</div>
                    <div className="col-span-3 text-sm font-medium text-gray-700">마지막 필기</div>
                </div>

                {/* 테이블 바디 */}
                <div className="divide-y divide-gray-100">
                    {pageParticipation.map((page) => (
                        <div
                            key={page.pageNumber}
                            className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                        >
                            {/* 페이지 번호 */}
                            <div className="col-span-2 flex items-center">
                                <p className="font-medium text-gray-800">페이지 {page.pageNumber}</p>
                            </div>

                            {/* 필기 시간 */}
                            <div className="col-span-2 flex items-center">
                                <p className="text-sm text-gray-800">{formatTime(page.writingTime)}</p>
                            </div>

                            {/* 획 수 */}
                            <div className="col-span-2 flex items-center">
                                <p className="text-sm text-gray-800">{page.strokeCount}획</p>
                            </div>

                            {/* 첫 필기 */}
                            <div className="col-span-3 flex items-center">
                                <p className="text-sm text-gray-600">{page.firstWriteTime}</p>
                            </div>

                            {/* 마지막 필기 */}
                            <div className="col-span-3 flex items-center">
                                <p className="text-sm text-gray-600">{page.lastWriteTime}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 합계 */}
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-blue-50 border-t-2 border-blue-200">
                    <div className="col-span-2 flex items-center">
                        <p className="font-bold text-gray-800">합계</p>
                    </div>
                    <div className="col-span-2 flex items-center">
                        <p className="text-sm font-bold text-gray-800">
                            {formatTime(pageParticipation.reduce((sum, p) => sum + p.writingTime, 0))}
                        </p>
                    </div>
                    <div className="col-span-2 flex items-center">
                        <p className="text-sm font-bold text-gray-800">
                            {pageParticipation.reduce((sum, p) => sum + p.strokeCount, 0)}획
                        </p>
                    </div>
                    <div className="col-span-6"></div>
                </div>
            </div>
        </div>
    );
}
