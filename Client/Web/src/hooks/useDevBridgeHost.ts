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

// 게스트별 writing 타이머 (2초 후 자동 해제)
const writingTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

    // 게스트 필기 중 상태 → writingUsers + lastActivityByUser 동시 갱신
    const handleGuestWriting = (event: BridgeEvent) => {
      if (event.type !== 'GUEST_WRITING' || event.code !== sessionCode) return;

      // 1회 setState로 writingUsers + lastActivityByUser 동시 갱신
      useStrokeStore.setState((state) => {
        const nextWriting = new Set(state.writingUsers);
        nextWriting.add(event.userId);
        const nextActivity = new Map(state.lastActivityByUser);
        nextActivity.set(event.userId, Date.now());
        return { writingUsers: nextWriting, lastActivityByUser: nextActivity };
      });

      // 2초 후 writing 해제
      const existing = writingTimers.get(event.userId);
      if (existing) clearTimeout(existing);
      writingTimers.set(event.userId, setTimeout(() => {
        useStrokeStore.setState((state) => {
          const nextWriting = new Set(state.writingUsers);
          nextWriting.delete(event.userId);
          return { writingUsers: nextWriting };
        });
        writingTimers.delete(event.userId);
      }, 2000));
    };

    devBridge.on('GUEST_JOIN', handleGuestJoin);
    devBridge.on('STROKE_ADDED', handleStrokeAdded);
    devBridge.on('GUEST_WRITING', handleGuestWriting);

    return () => {
      devBridge.off('GUEST_JOIN', handleGuestJoin);
      devBridge.off('STROKE_ADDED', handleStrokeAdded);
      devBridge.off('GUEST_WRITING', handleGuestWriting);
      // 타이머 정리
      writingTimers.forEach((t) => clearTimeout(t));
      writingTimers.clear();
    };
  }, [sessionCode]);
}
