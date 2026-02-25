import { useSessionStore } from '../../stores/session-store';

/**
 * 참가자 모드 뷰 — Phase 2-2에서 모니터링 그리드 + 첨삭 기능으로 채워질 예정
 */
export function ParticipantModeView() {
  const session = useSessionStore((state) => state.session);
  const participants = session?.participants ?? [];
  const guests = participants.filter((p) => p.role !== 'host');

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 gap-4 p-8">
      {guests.length === 0 ? (
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">아직 참가자가 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">세션 코드를 공유하여 학생을 초대하세요</p>
          <p className="text-xs text-gray-300 mt-4">참가자 모니터링 그리드는 Phase 2-2에서 추가됩니다</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-gray-600 font-medium">{guests.length}명 참가 중</p>
          <ul className="mt-4 space-y-2">
            {guests.map((p) => (
              <li key={p.userId} className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-100">
                {p.userName}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-300 mt-6">참가자 모니터링 그리드는 Phase 2-2에서 추가됩니다</p>
        </div>
      )}
    </div>
  );
}
