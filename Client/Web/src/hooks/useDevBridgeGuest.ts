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
import { devBridge } from '../services/dev-bridge';
import type { BridgeEvent } from '../services/dev-bridge';

export function useDevBridgeGuest(
  sessionCode: string | null,
  guestUserId: string | null,
): void {
  useEffect(() => {
    if (!import.meta.env.DEV || !sessionCode || !guestUserId) return;

    // 스트로크 스토어 구독: 새 스트로크가 추가되면 호스트 탭으로 전송
    const unsubStroke = useStrokeStore.subscribe((state, prevState) => {
      // 새로 추가된 스트로크 감지
      for (const [id, stroke] of state.strokes) {
        if (!prevState.strokes.has(id) && stroke.ownerUserId === guestUserId) {
          devBridge.send({ type: 'STROKE_ADDED', stroke, code: sessionCode });
        }
      }
    });

    // 브릿지에서 첨삭 수신 → annotation-store에 저장
    const handleAnnotation = (event: BridgeEvent) => {
      if (event.type !== 'ANNOTATION_ADDED' || event.targetUserId !== guestUserId) return;
      useAnnotationStore.getState().addAnnotation(guestUserId, event.annotation);
    };

    devBridge.on('ANNOTATION_ADDED', handleAnnotation);

    return () => {
      unsubStroke();
      devBridge.off('ANNOTATION_ADDED', handleAnnotation);
    };
  }, [sessionCode, guestUserId]);
}
