/**
 * 참가자 활동 상태 추적 훅
 *
 * 각 참가자의 활동 상태를 실시간으로 반환:
 * - 'writing': 현재 필기 중 (writingUsers에 존재 또는 activeStrokes에 존재)
 * - 'idle': 마지막 필기 후 5분 미만
 * - 'inactive': 마지막 필기 후 5분 이상 또는 필기 이력 없음
 */

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useStrokeStore } from '../stores/stroke-store';
import type { ParticipantActivityStatus } from '../types';

const INACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5분
const REFRESH_INTERVAL_MS = 10 * 1000; // 10초마다 상태 재평가

export function useParticipantActivity(): {
  getStatus: (userId: string) => ParticipantActivityStatus;
} {
  // stroke-store 전체를 snapshot으로 구독 (writingUsers, activeStrokes, lastActivityByUser 모두 감지)
  const store = useSyncExternalStore(
    useStrokeStore.subscribe,
    () => useStrokeStore.getState()
  );

  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // 10초마다 idle/inactive 재평가
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const getStatus = useCallback(
    (userId: string): ParticipantActivityStatus => {
      // writingUsers에 포함되어 있으면 writing (크로스탭 DEV 모드)
      if (store.writingUsers?.has(userId)) {
        return 'writing';
      }

      // activeStrokes에서 해당 userId의 활성 스트로크가 있으면 writing (같은 탭)
      for (const stroke of store.activeStrokes.values()) {
        if (stroke.ownerUserId === userId) {
          return 'writing';
        }
      }

      // lastActivityByUser에서 마지막 활동 시각 확인
      const lastActivity = store.lastActivityByUser.get(userId);
      if (!lastActivity) return 'inactive';

      const elapsed = Date.now() - lastActivity;
      if (elapsed < INACTIVE_THRESHOLD_MS) return 'idle';

      return 'inactive';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.writingUsers, store.activeStrokes, store.lastActivityByUser, tick]
  );

  return { getStatus };
}
