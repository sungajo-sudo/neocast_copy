import { useState } from 'react';
import { useSessionStore } from '../../stores/session-store';
import { useConnectionStore } from '../../stores/connection-store';
import { StudentCard } from './StudentCard';
import { StudentDetailModal } from './StudentDetailModal';
import type { Participant } from '../../types';

/**
 * 참가자 모드 뷰 — 학생 모니터링 그리드 + 빨간펜 첨삭
 * Phase 2-2 구현
 */
export function ParticipantModeView() {
  const session = useSessionStore((state) => state.session);
  const controlSocket = useConnectionStore((state) => state.controlSocket);
  const [selectedStudent, setSelectedStudent] = useState<Participant | null>(null);
  const [annotatingUserId, setAnnotatingUserId] = useState<string | null>(null);

  // 게스트(학생)만 필터
  const students = (session?.participants ?? []).filter((p) => p.role !== 'host');

  const handleAnnotationStroke = (targetUserId: string, points: { x: number; y: number }[]) => {
    setAnnotatingUserId(targetUserId);
    controlSocket?.emit('annotation:stroke', { targetUserId, points });
    // 3초 후 "첨삭중" 배지 해제
    setTimeout(() => {
      setAnnotatingUserId((prev) => (prev === targetUserId ? null : prev));
    }, 3000);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-700">
          참가자 모니터링
          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
            {students.length}명
          </span>
        </h2>
        {students.length > 0 && (
          <p className="text-xs text-gray-400">카드를 클릭하면 상세 보기 및 첨삭이 가능합니다</p>
        )}
      </div>

      {/* 그리드 */}
      <div className="flex-1 p-6">
        {students.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-500 font-medium">아직 참가자가 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">세션 코드를 공유하여 학생을 초대하세요</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {students.map((student) => (
              <StudentCard
                key={student.userId}
                participant={student}
                isAnnotating={annotatingUserId === student.userId}
                onClick={() => setSelectedStudent(student)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 학생 상세 모달 */}
      {selectedStudent && (
        <StudentDetailModal
          participant={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onAnnotationStroke={handleAnnotationStroke}
        />
      )}
    </div>
  );
}
