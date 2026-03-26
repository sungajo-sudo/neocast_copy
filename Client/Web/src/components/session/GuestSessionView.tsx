/**
 * 게스트 세션 뷰 — 내 캔버스 + 첨삭 오버레이 + 첨삭 배너
 */

import { useMemo } from 'react';
import { CanvasContainer } from '../canvas';
import { GuestAnnotationOverlay } from './GuestAnnotationOverlay';
import { AnnotationBanner } from './AnnotationBanner';
import { useSessionStore } from '../../stores/session-store';
import { useAnnotationStatusStore } from '../../stores/annotation-status-store';

interface Props {
  canInput: boolean;
}

export function GuestSessionView({ canInput }: Props) {
  const currentUserId = useSessionStore((state) => state.currentUserId);

  const activeTargets = useAnnotationStatusStore((state) => state.activeAnnotationTargets);
  const isBeingAnnotated = useMemo(
    () => (currentUserId ? activeTargets.has(currentUserId) : false),
    [activeTargets, currentUserId]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* 첨삭 배너 */}
      {isBeingAnnotated && <AnnotationBanner />}

      {/* 캔버스 (첨삭 중이면 빨간 글로우 테두리) */}
      <div
        className={`flex-1 relative transition-shadow ${isBeingAnnotated ? 'ring-2 ring-red-400' : ''}`}
        style={isBeingAnnotated ? { boxShadow: '0 0 24px rgba(255, 59, 48, 0.25)' } : undefined}
      >
        <CanvasContainer className="flex-1" inputEnabled={canInput} />
        {currentUserId && <GuestAnnotationOverlay userId={currentUserId} />}
      </div>
    </div>
  );
}
