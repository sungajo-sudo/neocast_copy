import { useRef, useEffect, useCallback } from 'react';
import type { AnnotationStroke } from '../../stores/annotation-store';

const ANNOTATION_COLOR = '#FF3B30';
const ANNOTATION_LINE_WIDTH = 3;

interface Props {
  width: number;
  height: number;
  /** 기존 첨삭 스트로크 표시 */
  strokes: AnnotationStroke[];
  /** 그리기 모드 여부 (호스트 첨삭 시 true) */
  drawingMode?: boolean;
  /** 스트로크 완료 시 콜백 — normalized (0-1) 좌표 */
  onStroke?: (points: { x: number; y: number }[]) => void;
  className?: string;
}

/**
 * 첨삭 오버레이 캔버스
 * - 기존 첨삭 스트로크 렌더링
 * - drawingMode=true 시 마우스/터치로 빨간펜 그리기
 * - 좌표는 normalized (0~1) 범위로 관리
 */
export function AnnotationCanvas({ width, height, strokes, drawingMode = false, onStroke, className = '' }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  // ── 기존 스트로크 렌더링 ──
  useEffect(() => {
    const canvas = displayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.85;

      ctx.beginPath();
      const p0 = stroke.points[0];
      ctx.moveTo(p0.x * width, p0.y * height);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const mid = {
          x: ((stroke.points[i].x + stroke.points[i + 1].x) / 2) * width,
          y: ((stroke.points[i].y + stroke.points[i + 1].y) / 2) * height,
        };
        ctx.quadraticCurveTo(stroke.points[i].x * width, stroke.points[i].y * height, mid.x, mid.y);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x * width, last.y * height);
      ctx.stroke();
      ctx.restore();
    }
  }, [strokes, width, height]);

  // ── 그리기 캔버스 초기화 ──
  useEffect(() => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, [width, height]);

  const getCanvasCoords = useCallback((e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const redrawCurrentPath = useCallback(() => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const pts = currentPointsRef.current;
    if (pts.length < 2) return;

    ctx.save();
    ctx.strokeStyle = ANNOTATION_COLOR;
    ctx.lineWidth = ANNOTATION_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * width, pts[0].y * height);
    for (let i = 1; i < pts.length - 1; i++) {
      const mid = {
        x: ((pts[i].x + pts[i + 1].x) / 2) * width,
        y: ((pts[i].y + pts[i + 1].y) / 2) * height,
      };
      ctx.quadraticCurveTo(pts[i].x * width, pts[i].y * height, mid.x, mid.y);
    }
    ctx.lineTo(pts[pts.length - 1].x * width, pts[pts.length - 1].y * height);
    ctx.stroke();
    ctx.restore();
  }, [width, height]);

  // ── 마우스 이벤트 ──
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !drawRef.current) return;
    isDrawingRef.current = true;
    const pt = getCanvasCoords(e.nativeEvent, drawRef.current);
    currentPointsRef.current = [pt];
  }, [drawingMode, getCanvasCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !drawRef.current) return;
    const pt = getCanvasCoords(e.nativeEvent, drawRef.current);
    currentPointsRef.current.push(pt);
    redrawCurrentPath();
  }, [getCanvasCoords, redrawCurrentPath]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = currentPointsRef.current;
    if (pts.length >= 2) onStroke?.(pts);
    // 그리기 캔버스 클리어 (displayRef에서 렌더링됨)
    const canvas = drawRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx?.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    currentPointsRef.current = [];
  }, [onStroke]);

  // ── 터치 이벤트 ──
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !drawRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pt = getCanvasCoords(touch, drawRef.current);
    isDrawingRef.current = true;
    currentPointsRef.current = [pt];
  }, [drawingMode, getCanvasCoords]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !drawRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pt = getCanvasCoords(touch, drawRef.current);
    currentPointsRef.current.push(pt);
    redrawCurrentPath();
  }, [getCanvasCoords, redrawCurrentPath]);

  const handleTouchEnd = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* 기존 첨삭 표시 캔버스 */}
      <canvas ref={displayRef} className="absolute inset-0 pointer-events-none" />
      {/* 실시간 그리기 캔버스 */}
      <canvas
        ref={drawRef}
        className={`absolute inset-0 ${drawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
