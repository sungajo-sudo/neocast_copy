import { useParams, useNavigate } from 'react-router-dom';

export default function StudentReportDetail() {
    const { sessionId, studentId } = useParams();
    const navigate = useNavigate();

    return (
        <div className="p-8">
            <button
                onClick={() => navigate(`/host/results/${sessionId}`)}
                className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
            >
                ← 세션 대시보드로
            </button>

            <h1 className="text-3xl font-bold text-gray-800 mb-8">개별 학생 리포트</h1>

            <div className="bg-white rounded-2xl shadow-sm p-8">
                <p className="text-gray-500">
                    세션 ID: {sessionId}
                    <br />
                    학생 ID: {studentId}
                    <br />
                    개별 학생 리포트 UI는 8단계에서 구현됩니다.
                </p>
            </div>
        </div>
    );
}
