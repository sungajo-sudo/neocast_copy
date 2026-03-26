/**
 * DEV 모드 게스트 브릿지 훅
 *
 * 게스트 탭에서 사용:
 * - 스트로크 완료 감지 → 호스트 탭으로 전송
 * - 호스트 첨삭 수신 → annotation-store에 저장
 */

import { useEffect } from 'react';
import { useStrokeStore } from '../stores/stroke-store';
import { useAnnotationStore } from '../stores/annotation-store';
import { useAnnotationStatusStore } from '../stores/annotation-status-store';
import { devBridge } from '../services/dev-bridge';
import type { BridgeEvent } from '../services/dev-bridge';

export function useDevBridgeGuest(
  sessionCode: string | null,
  guestUserId: string | null,
): void {
  useEffect(() => {
    if (!import.meta.env.DEV || !sessionCode || !guestUserId) return;

    // 스트로크 스토어 구독: 완료된 스트로크 + 필기 중 상태를 호스트 탭으로 전송
    let lastWritingSent = 0;
    const unsubStroke = useStrokeStore.subscribe((state, prevState) => {
      // 새로 완료된 스트로크 전송
      for (const [id, stroke] of state.strokes) {
        if (!prevState.strokes.has(id) && stroke.ownerUserId === guestUserId) {
          devBridge.send({ type: 'STROKE_ADDED', stroke, code: sessionCode });
        }
      }

      // 필기 중 상태 전송 (activeStrokes에 자신의 스트로크가 있으면, 500ms 쓰로틀)
      const hasActive = Array.from(state.activeStrokes.values()).some(
        (s) => s.ownerUserId === guestUserId
      );
      const now = Date.now();
      if (hasActive && now - lastWritingSent > 500) {
        lastWritingSent = now;
        devBridge.send({ type: 'GUEST_WRITING', userId: guestUserId, code: sessionCode });
      }
    });

    // 브릿지에서 첨삭 수신 → annotation-store에 저장 + 첨삭 상태 갱신
    const handleAnnotation = (event: BridgeEvent) => {
      if (event.type !== 'ANNOTATION_ADDED' || event.targetUserId !== guestUserId) return;
      // 첨삭 상태 갱신 (배너/글로우 표시)
      useAnnotationStatusStore.getState().setAnnotating(guestUserId);
      // 실제 스트로크가 있는 경우에만 캔버스에 추가
      if (event.annotation.points.length >= 2) {
        useAnnotationStore.getState().addAnnotation(guestUserId, event.annotation);
      }
    };

    devBridge.on('ANNOTATION_ADDED', handleAnnotation);

    return () => {
      unsubStroke();
      devBridge.off('ANNOTATION_ADDED', handleAnnotation);
    };
  }, [sessionCode, guestUserId]);
}
