import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePanelStore } from '../../stores/panel-store';
import { PagesPanel, MyPapersPanel } from '../panels';

/**
 * 왼쪽 패널 컨테이너
 * 페이지, 내 자료 패널 표시
 * 리사이즈 가능
 */
export const LeftPanelContainer: React.FC = () => {
  const activeLeftPanel = usePanelStore((state) => state.activeLeftPanel);
  const leftPanelWidth = usePanelStore((state) => state.leftPanelWidth);
  const setLeftPanelWidth = usePanelStore((state) => state.setLeftPanelWidth);

  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  // 리사이즈 시작
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // 리사이즈 중
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      setLeftPanelWidth(newWidth);
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
  }, [isResizing, setLeftPanelWidth]);

  if (!activeLeftPanel) {
    return null;
  }

  return (
    <aside
      ref={containerRef}
      className="relative border-r border-[#fff1e6] bg-white flex-shrink-0 h-full"
      style={{
        width: `${leftPanelWidth}px`,
      }}
    >
      {activeLeftPanel === 'pages' && <PagesPanel />}
      {activeLeftPanel === 'myPapers' && <MyPapersPanel />}

      {/* 리사이즈 핸들 */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize group hover:bg-blue-500/50 transition-colors ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleResizeStart}
      >
        {/* 드래그 인디케이터 */}
        <div
          className={`absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-opacity ${
            isResizing ? 'bg-blue-500 opacity-100' : 'bg-gray-300 opacity-0 group-hover:opacity-100'
          }`}
        />
      </div>

      {/* 리사이즈 중 오버레이 (다른 요소와 상호작용 방지) */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-ew-resize" />
      )}
    </aside>
  );
};

export default LeftPanelContainer;
