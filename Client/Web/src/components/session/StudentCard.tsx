import { useStrokeStore } from '../../stores/stroke-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { StrokeCanvas } from '../canvas/StrokeCanvas';
import { AnnotationCanvas } from '../canvas/AnnotationCanvas';
import type { Participant } from '../../types';

const CARD_W = 240;
const CARD_H = 160;

interface Props {
  participant: Participant;
  /** 현재 이 학생에게 첨삭 중 (빨간 테두리) */
  isAnnotating: boolean;
  onClick: () => void;
}

/**
 * 학생 미니 카드 — 참가자 모드 뷰 그리드에 표시
 */
export function StudentCard({ participant, isAnnotating, onClick }: Props) {
  const pageAddress = useStrokeStore((state) => state.currentPageAddress);
  const annotations = useAnnotationStore((state) => state.getAnnotations(participant.userId));

  // 첫 글자 아바타
  const initial = participant.userName.charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col rounded-xl overflow-hidden shadow-sm border-2 transition-all hover:shadow-md hover:scale-[1.02] bg-white ${
        isAnnotating
          ? 'border-red-400 shadow-red-200 shadow-md'
          : 'border-gray-200 hover:border-blue-300'
      }`}
      style={{ width: CARD_W }}
    >
      {/* 캔버스 영역 */}
      <div className="relative bg-gray-50" style={{ width: CARD_W, height: CARD_H }}>
        <StrokeCanvas
          pageAddress={pageAddress}
          width={CARD_W}
          height={CARD_H}
          userId={participant.userId}
        />
        <AnnotationCanvas
          width={CARD_W}
          height={CARD_H}
          strokes={annotations}
          className="absolute inset-0"
        />

        {/* 첨삭중 뱃지 */}
        {isAnnotating && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full shadow">
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            첨삭중
          </div>
        )}
      </div>

      {/* 학생 정보 */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100">
        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-blue-600">{initial}</span>
        </div>
        <span className="text-xs font-medium text-gray-700 truncate">{participant.userName}</span>
      </div>
    </button>
  );
}
