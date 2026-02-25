import { useEffect, useState } from 'react';
import { useAnnotationStore } from '../../stores/annotation-store';
import { AnnotationCanvas } from '../canvas/AnnotationCanvas';

interface Props {
  userId: string;
}

/**
 * 게스트 화면 첨삭 오버레이
 * 호스트가 보낸 첨삭(AnnotationStroke)을 화면 전체에 표시합니다.
 * Phase 3-1: 첨삭 수신 뷰
 */
export function GuestAnnotationOverlay({ userId }: Props) {
  const annotations = useAnnotationStore((state) => state.getAnnotations(userId));
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (annotations.length === 0) return null;

  return (
    <AnnotationCanvas
      width={size.w}
      height={size.h}
      strokes={annotations}
      className="fixed inset-0 z-20 pointer-events-none"
    />
  );
}
