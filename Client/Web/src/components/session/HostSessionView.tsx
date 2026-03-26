import { useState } from 'react';
import { CanvasContainer } from '../canvas';
import { ParticipantMonitorView } from './ParticipantMonitorView';

type ViewTab = 'canvas' | 'participants';

interface Props {
  canInput: boolean;
}

/**
 * 호스트 세션 뷰 — 상단 탭으로 기본 뷰 / 참가자 모드 뷰 전환
 *
 * Phase 2-1: 탭 UI 추가 (참가자 모드 뷰는 Phase 2-2에서 구현)
 */
export function HostSessionView({ canInput }: Props) {
  const [activeTab, setActiveTab] = useState<ViewTab>('canvas');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── 상단 뷰 탭 ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('canvas')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'canvas'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          기본 뷰
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('participants')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'participants'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          참가자 모드 뷰
        </button>
      </div>

      {/* ── 탭 콘텐츠 ── */}
      {activeTab === 'canvas' ? (
        <CanvasContainer className="flex-1" inputEnabled={canInput} forceSingleView />
      ) : (
        <ParticipantMonitorView />
      )}
    </div>
  );
}
