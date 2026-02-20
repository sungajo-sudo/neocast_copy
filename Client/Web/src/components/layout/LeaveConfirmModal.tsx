import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { useSessionStore } from '../../stores/session-store';

interface LeaveConfirmModalProps {
  onConfirm: () => void;
}

/**
 * 세션 나가기 확인 모달
 */
export const LeaveConfirmModal: React.FC<LeaveConfirmModalProps> = ({ onConfirm }) => {
  const { t } = useTranslation();
  const isLeaveConfirmOpen = usePanelStore((state) => state.isLeaveConfirmOpen);
  const setLeaveConfirmOpen = usePanelStore((state) => state.setLeaveConfirmOpen);
  const isHost = useSessionStore((state) => state.isHost);

  if (!isLeaveConfirmOpen) {
    return null;
  }

  const handleConfirm = () => {
    setLeaveConfirmOpen(false);
    onConfirm();
  };

  const handleCancel = () => {
    setLeaveConfirmOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in duration-200">
        {/* 아이콘 */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>

        {/* 제목 */}
        <h3 className="text-xl font-bold text-center text-gray-800 mb-2">
          {isHost
            ? t('leave.endSessionTitle', 'End Session?')
            : t('leave.leaveSessionTitle', 'Leave Session?')}
        </h3>

        {/* 설명 */}
        <p className="text-center text-gray-600 mb-6">
          {isHost
            ? t('leave.endSessionDesc', 'This will end the session for all participants.')
            : t('leave.leaveSessionDesc', 'You can rejoin later if the session is still active.')}
        </p>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
          >
            {isHost
              ? t('leave.endSession', 'End Session')
              : t('leave.leave', 'Leave')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveConfirmModal;
