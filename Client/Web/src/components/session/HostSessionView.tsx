import { CanvasContainer } from '../canvas';
// ParticipantMonitorView는 비활성화 — 기능이 CanvasContainer 스포트라이트에 통합됨
// import { ParticipantMonitorView } from './ParticipantMonitorView';

interface Props {
  canInput: boolean;
}

/**
 * 호스트 세션 뷰 — 탭 없이 CanvasContainer 직접 렌더링
 *
 * Phase F-1: 탭 제거 (기본 뷰 / 참가자 모드 뷰 통합)
 * 그리드 클릭 → 스포트라이트 전환으로 모니터링 기능 통합
 */
export function HostSessionView({ canInput }: Props) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <CanvasContainer className="flex-1" inputEnabled={canInput} />
    </div>
  );
}
