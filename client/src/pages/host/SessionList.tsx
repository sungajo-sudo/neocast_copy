import { useState } from 'react';
import CreateSessionModal from '../../components/modals/CreateSessionModal';

export default function SessionList() {
    const [showCreateModal, setShowCreateModal] = useState(false);

    return (
        <div className="p-8">
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

            <div className="bg-white rounded-2xl shadow-sm p-8">
                <p className="text-gray-500">세션 목록 전체 UI는 4단계에서 구현됩니다.</p>
            </div>

            {/* 세션 만들기 모달 */}
            <CreateSessionModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={(code) => {
                    console.log('세션 생성 완료:', code);
                }}
            />
        </div>
    );
}
