export default function Dashboard() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                안녕하세요, {localStorage.getItem('nc_host_nickname') || '선생님'}님!
            </h1>
            <p className="text-gray-600 mb-8">오늘도 스마트한 수업을 시작해볼까요?</p>

            <div className="bg-white rounded-2xl shadow-sm p-8">
                <p className="text-gray-500">홈 화면 UI는 다음 단계에서 구현됩니다.</p>
            </div>
        </div>
    );
}
