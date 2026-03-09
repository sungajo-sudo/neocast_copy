/**
 * pen-event-bridge.ts
 * pen-input.service.ts 수정 없이 첫 필기 시작 이벤트를 감지하는 브릿지.
 * nc_writing_${sessionId}_${userId} 키가 처음 생기는 순간 = 펜 필기 시작.
 */

/**
 * 첫 필기 시작을 감지하고 onFirstStroke 콜백을 한 번만 호출한다.
 * @returns cleanup 함수 (컴포넌트 언마운트 시 호출)
 */
export function watchFirstPenStroke(
    sessionId: string,
    userId: string,
    onFirstStroke: () => void,
): () => void {
    let stopped = false;
    const key = `nc_writing_${sessionId}_${userId}`;

    const poll = () => {
        if (stopped) return;
        if (localStorage.getItem(key) !== null) {
            onFirstStroke();
            return; // 한 번만 트리거 — 이후 폴링 중단
        }
        setTimeout(poll, 200);
    };

    poll();
    return () => { stopped = true; };
}
