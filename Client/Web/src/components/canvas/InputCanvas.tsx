import { useRef, useCallback, useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStrokeStore } from '../../stores/stroke-store';
import { useSessionStore } from '../../stores/session-store';
import { strokeService } from '../../services/stroke-service';
import { StrokeFlags, getPaperSizeInPoints } from '../../types';
import type { NcodePageAddress } from '../../types';

interface InputCanvasProps {
  pageAddress: NcodePageAddress;
  width: number; // 화면 픽셀 크기
  height: number; // 화면 픽셀 크기
  scale?: number; // 캔버스 스케일 (1 = 100%)
  className?: string;
  disabled?: boolean;
  userId?: string; // 특정 사용자의 캔버스에 그리기 (그리드 뷰용)
}

/**
 * 마우스/터치 입력 캔버스
 */
export const InputCanvas: React.FC<InputCanvasProps> = ({
  pageAddress,
  width,
  height,
  scale = 1,
  className = '',
  disabled = false,
  userId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStrokeId, setCurrentStrokeId] = useState<string | null>(null);

  // 스타일러스/터치 입력 설정 사용
  const stylusSettings = useStrokeStore((state) => state.stylusSettings);
  const { penColor, penThickness, penType } = stylusSettings;
  const paperSize = useStrokeStore((state) => state.paperSize);

  // 선택된 용지 크기 (72 DPI points)
  const { widthPt: paperWidthPt, heightPt: paperHeightPt } = useMemo(
    () => getPaperSizeInPoints(paperSize),
    [paperSize]
  );

  // 캔버스 소유자 결정: selectedViewUserId가 있으면 해당 사용자, 없으면 자신
  const selectedViewUserId = useSessionStore((state) => state.selectedViewUserId);
  const currentUserId = useSessionStore((state) => state.currentUserId);

  /**
   * 캔버스 좌표로 변환 (화면 픽셀 → 72 DPI point)
   */
  const getCanvasCoordinates = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number; pressure: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number, pressure: number;

      if ('touches' in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
        // Touch 이벤트의 force 사용 (0~1)
        pressure = 'force' in touch ? (touch as Touch & { force: number }).force : 0.5;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
        // 마우스는 고정 압력
        pressure = 0.5;
      }

      // 화면 좌표를 캔버스 로컬 좌표로 변환 (스케일 적용)
      const localX = (clientX - rect.left) / scale;
      const localY = (clientY - rect.top) / scale;

      // 캔버스 로컬 좌표(pixel)를 72 DPI point로 변환
      // 캔버스 width/height가 용지 크기(72DPI)에 대응되므로 비율로 변환
      const x = (localX / width) * paperWidthPt;
      const y = (localY / height) * paperHeightPt;

      // 압력을 0~65535 범위로 변환
      const normalizedPressure = Math.floor(pressure * 65535);

      return { x, y, pressure: normalizedPressure };
    },
    [scale, width, height, paperWidthPt, paperHeightPt]
  );

  /**
   * 그리기 시작
   */
  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled || !currentUserId) return;
      e.preventDefault();

      const strokeId = uuidv4();
      const { x, y, pressure } = getCanvasCoordinates(e);

      // 캔버스 소유자: userId prop이 있으면 해당 사용자, 특정 사용자 페이지를 보고 있으면 해당 사용자, 아니면 자신
      const ownerUserId = userId ?? selectedViewUserId ?? currentUserId;

      setIsDrawing(true);
      setCurrentStrokeId(strokeId);

      // 스트로크 시작 (ownerUserId = 누구의 캔버스에 그려지는지)
      strokeService.startStroke(strokeId, ownerUserId, pageAddress, penColor, penThickness, penType, StrokeFlags.None);
      strokeService.addPoint(strokeId, x, y, pressure);
    },
    [disabled, currentUserId, userId, selectedViewUserId, pageAddress, penColor, penThickness, penType, getCanvasCoordinates]
  );

  /**
   * 그리기 진행
   */
  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !currentStrokeId || disabled) return;
      e.preventDefault();

      const { x, y, pressure } = getCanvasCoordinates(e);
      strokeService.addPoint(currentStrokeId, x, y, pressure);
    },
    [isDrawing, currentStrokeId, disabled, getCanvasCoordinates]
  );

  /**
   * 그리기 종료
   */
  const handleEnd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !currentStrokeId) return;
      e.preventDefault();

      strokeService.endStroke(currentStrokeId);
      setIsDrawing(false);
      setCurrentStrokeId(null);
    },
    [isDrawing, currentStrokeId]
  );

  /**
   * 그리기 취소 (캔버스 밖으로 나감)
   */
  const handleLeave = useCallback(
    (_e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !currentStrokeId) return;

      // 캔버스를 벗어나도 스트로크 종료
      strokeService.endStroke(currentStrokeId);
      setIsDrawing(false);
      setCurrentStrokeId(null);
    },
    [isDrawing, currentStrokeId]
  );

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={width}
      height={height}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
        top: 0,
        left: 0,
        touchAction: 'none',
        cursor: disabled ? 'not-allowed' : 'crosshair',
        pointerEvents: disabled ? 'none' : 'auto',
        // 투명 캔버스 (입력만 담당)
        background: 'transparent',
      }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleLeave}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleLeave}
    />
  );
};

export default InputCanvas;
