import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePanelStore } from '../../stores/panel-store';
import { ChatPanel, ParticipantsPanel } from '../panels';

interface RightPanelContainerProps {
  onCopySessionCode?: () => void;
  onCopyInviteLink?: () => void;
}

/**
 * 오른쪽 패널 컨테이너
 * 참가자, 채팅 패널 표시
 * 리사이즈 가능
 */
export const RightPanelContainer: React.FC<RightPanelContainerProps> = ({
  onCopySessionCode,
  onCopyInviteLink,
}) => {
  const activeRightPanel = usePanelStore((state) => state.activeRightPanel);
  const rightPanelWidth = usePanelStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePanelStore((state) => state.setRightPanelWidth);

  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  // 리사이즈 시작
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  // 리사이즈 중
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      // 오른쪽 패널이므로 오른쪽 끝에서 마우스 위치까지의 거리
      const newWidth = containerRect.right - e.clientX;
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setRightPanelWidth]);

  if (!activeRightPanel) {
    return null;
  }

  return (
    <aside
      ref={containerRef}
      className="relative border-l border-white/50 bg-white/40 backdrop-blur-md flex-shrink-0 transition-colors duration-300 ease-in-out h-full"
      style={{
        width: `${rightPanelWidth}px`,
      }}
    >
      {/* 리사이즈 핸들 (왼쪽 가장자리) - 더 넓은 클릭 영역 */}
      <div
        className={`absolute -left-1 top-0 bottom-0 w-3 cursor-ew-resize z-10 group ${
          isResizing ? 'bg-blue-500/30' : ''
        }`}
        onMouseDown={handleResizeStart}
      >
        {/* 시각적 핸들 라인 */}
        <div
          className={`absolute left-1 top-0 bottom-0 w-1 transition-colors ${
            isResizing ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-500/50'
          }`}
        />
        {/* 드래그 인디케이터 */}
        <div
          className={`absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-opacity ${
            isResizing ? 'bg-blue-500 opacity-100' : 'bg-gray-400 opacity-0 group-hover:opacity-100'
          }`}
        />
      </div>

      {/* 리사이즈 중 오버레이 (다른 요소와 상호작용 방지) */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-ew-resize" />
      )}

      {activeRightPanel === 'participants' && (
        <ParticipantsPanel
          onCopySessionCode={onCopySessionCode}
          onCopyInviteLink={onCopyInviteLink}
        />
      )}
      {activeRightPanel === 'chat' && <ChatPanel />}
    </aside>
  );
};

export default RightPanelContainer;
