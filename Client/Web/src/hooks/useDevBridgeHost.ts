/**
 * DEV 모드 호스트 브릿지 훅
 *
 * 호스트 탭에서 사용:
 * - 게스트 참가 이벤트 수신 → 세션 스토어에 참가자 추가
 * - 게스트 스트로크 수신 → 스트로크 스토어에 히스토리 추가
 */

import { useEffect } from 'react';
import { useSessionStore } from '../stores/session-store';
import { useStrokeStore } from '../stores/stroke-store';
import { ParticipantRole } from '../types';
import { devBridge } from '../services/dev-bridge';
import type { BridgeEvent } from '../services/dev-bridge';

export function useDevBridgeHost(sessionCode: string | null): void {
  useEffect(() => {
    if (!import.meta.env.DEV || !sessionCode) return;

    const handleGuestJoin = (event: BridgeEvent) => {
      if (event.type !== 'GUEST_JOIN' || event.code !== sessionCode) return;
      useSessionStore.getState().addParticipant({
        userId: event.userId,
        userName: event.userName,
        role: ParticipantRole.Guest,
        joinedAt: Date.now(),
        isMuted: false,
        isSpeaking: false,
      });
    };

    const handleStrokeAdded = (event: BridgeEvent) => {
      if (event.type !== 'STROKE_ADDED' || event.code !== sessionCode) return;
      useStrokeStore.getState().addHistoryStroke(event.stroke);
    };

    devBridge.on('GUEST_JOIN', handleGuestJoin);
    devBridge.on('STROKE_ADDED', handleStrokeAdded);

    return () => {
      devBridge.off('GUEST_JOIN', handleGuestJoin);
      devBridge.off('STROKE_ADDED', handleStrokeAdded);
    };
  }, [sessionCode]);
}
