import { useState } from 'react';
import { useStrokeStore } from '../../stores/stroke-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { StrokeCanvas } from '../canvas/StrokeCanvas';
import { AnnotationCanvas } from '../canvas/AnnotationCanvas';
import type { Participant } from '../../types';

const MODAL_W = 640;
const MODAL_H = 480;

interface Props {
  participant: Participant;
  onClose: () => void;
  onAnnotationStroke: (targetUserId: string, points: { x: number; y: number }[]) => void;
}

/**
 * 학생 상세 모달 — 전체 캔버스 보기 + 빨간펜 첨삭
 */
export function StudentDetailModal({ participant, onClose, onAnnotationStroke }: Props) {
  const [annotationMode, setAnnotationMode] = useState(false);
  const pageAddress = useStrokeStore((state) => state.currentPageAddress);
  const annotations = useAnnotationStore((state) => state.getAnnotations(participant.userId));
  const addAnnotation = useAnnotationStore((state) => state.addAnnotation);

  const initial = participant.userName.charAt(0).toUpperCase();

  const handleStroke = (points: { x: number; y: number }[]) => {
    const stroke = { points, color: '#FF3B30', lineWidth: 3 };
    // 로컬 스토어에 즉시 반영
    addAnnotation(participant.userId, stroke);
    // 서버로 전송 (게스트에게 전달)
    onAnnotationStroke(participant.userId, points);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxWidth: MODAL_W + 32 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-bold text-blue-600">{initial}</span>
            </div>
            <span className="font-semibold text-gray-800">{participant.userName}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* 첨삭 모드 토글 */}
            <button
              type="button"
              onClick={() => setAnnotationMode(!annotationMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                annotationMode
                  ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {annotationMode ? '첨삭 중' : '첨삭 모드'}
            </button>

            {/* 닫기 */}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="relative bg-gray-50 p-4">
          <div className="relative rounded-lg overflow-hidden shadow-inner" style={{ width: MODAL_W, height: MODAL_H }}>
            <StrokeCanvas
              pageAddress={pageAddress}
              width={MODAL_W}
              height={MODAL_H}
              userId={participant.userId}
            />
            <AnnotationCanvas
              width={MODAL_W}
              height={MODAL_H}
              strokes={annotations}
              drawingMode={annotationMode}
              onStroke={handleStroke}
              className="absolute inset-0"
            />
          </div>

          {/* 힌트 텍스트 */}
          {annotationMode && (
            <p className="mt-2 text-center text-xs text-red-400">
              드래그하여 첨삭하세요 — 학생 화면에 실시간으로 표시됩니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
