import { useParams } from 'react-router-dom';

export default function SessionDetail() {
    const { sessionId } = useParams();

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">세션 상세 대시보드</h1>

            <div className="bg-white rounded-2xl shadow-sm p-8">
                <p className="text-gray-500">
                    세션 ID: {sessionId}
                    <br />
                    상세 대시보드 UI는 7단계에서 구현됩니다.
                </p>
            </div>
        </div>
    );
}
