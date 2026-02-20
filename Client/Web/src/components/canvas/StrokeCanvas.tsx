import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useStrokeStore } from '../../stores/stroke-store';
import { useSessionStore } from '../../stores/session-store';
import { PenType, isSamePageAddress, MM_TO_PT, getPaperSizeInPoints, isMousePage } from '../../types';
import type { Stroke, NcodePageAddress } from '../../types';
import { paperInfoService } from '../../services/paper-info-service';

interface StrokeCanvasProps {
  pageAddress: NcodePageAddress;
  width: number; // 화면 픽셀 크기
  height: number; // 화면 픽셀 크기
  scale?: number; // 추가 스케일 (기본 1)
  className?: string;
  userId?: string; // 특정 사용자의 스트로크만 표시 (그리드 뷰용)
}

/**
 * 스트로크 렌더링 캔버스
 */
export const StrokeCanvas: React.FC<StrokeCanvasProps> = ({
  pageAddress,
  width,
  height,
  scale = 1,
  className = '',
  userId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const getPageStrokes = useStrokeStore((state) => state.getPageStrokes);
  const activeStrokes = useStrokeStore((state) => state.activeStrokes);
  const paperSize = useStrokeStore((state) => state.paperSize);
  const selectedViewUserId = useSessionStore((state) => state.selectedViewUserId);
  const getViewableUserIds = useSessionStore((state) => state.getViewableUserIds);

  // NPROJ에서 가져온 페이지 크기 (Ncode 페이지용)
  const [nprojSizeInPoints, setNprojSizeInPoints] = useState<{
    widthPt: number;
    heightPt: number;
  } | null>(null);

  // Ncode 페이지의 crop margin 오프셋 (스트로크 좌표 변환에 필요)
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 페이지 변경 시 NPROJ 정보 로드 (페이지 크기 + crop margin)
  useEffect(() => {
    // 마우스 페이지는 NPROJ 없음 - fallback 사용
    if (isMousePage(pageAddress)) {
      setNprojSizeInPoints(null);
      setCropOffset({ x: 0, y: 0 });
      return;
    }

    // 페이지 변경 시 먼저 초기화 (이전 페이지 값이 남아있지 않도록)
    // 캐시에서 동기적으로 확인하여 값이 있으면 바로 설정
    const cachedSize = paperInfoService.getPageSizeInPoints(pageAddress);
    const cachedMargin = paperInfoService.getCropMarginInPoints(pageAddress);

    // 캐시에 없으면 null/기본값으로 설정 (fallback 사용)
    setNprojSizeInPoints(cachedSize);
    setCropOffset(cachedMargin ? { x: cachedMargin.left, y: cachedMargin.top } : { x: 0, y: 0 });

    // 둘 다 캐시에 있으면 완료
    if (cachedSize && cachedMargin) {
      return;
    }

    // 캐시 없으면 비동기 로드 시도
    let cancelled = false;
    paperInfoService.requestPaperInfo(pageAddress).then((result) => {
      if (cancelled) return;

      // paper-info가 없는 경우 (404 등) - fallback 유지
      if (!result) {
        setNprojSizeInPoints(null);
        setCropOffset({ x: 0, y: 0 });
        return;
      }

      const loadedSize = paperInfoService.getPageSizeInPoints(pageAddress);
      const loadedMargin = paperInfoService.getCropMarginInPoints(pageAddress);

      setNprojSizeInPoints(loadedSize);
      setCropOffset(loadedMargin ? { x: loadedMargin.left, y: loadedMargin.top } : { x: 0, y: 0 });
    });

    return () => {
      cancelled = true;
    };
  }, [pageAddress]);

  // 선택된 용지 크기 (72 DPI points)
  // NPROJ 크기가 있으면 우선 사용, 없으면 사용자 설정 사용
  const { widthPt: paperWidthPt, heightPt: paperHeightPt } = useMemo(() => {
    if (nprojSizeInPoints) {
      return { widthPt: nprojSizeInPoints.widthPt, heightPt: nprojSizeInPoints.heightPt };
    }
    return getPaperSizeInPoints(paperSize);
  }, [nprojSizeInPoints, paperSize]);

  // 볼 수 있는 사용자 ID 목록
  const viewableUserIds = useMemo(() => getViewableUserIds(), [getViewableUserIds]);

  // 스트로크 필터링 함수 (ownerUserId 기준으로 필터링)
  const shouldShowStroke = useCallback((stroke: Stroke): boolean => {
    // userId prop이 전달된 경우 해당 사용자의 스트로크만 표시 (그리드 뷰용)
    if (userId !== undefined) {
      return stroke.ownerUserId === userId;
    }
    // 특정 사용자 선택 시 해당 사용자의 캔버스에 속한 스트로크만 표시
    if (selectedViewUserId !== null) {
      return stroke.ownerUserId === selectedViewUserId;
    }
    // 전체 보기 시 볼 수 있는 사용자들의 캔버스에 속한 스트로크 표시
    return viewableUserIds.includes(stroke.ownerUserId);
  }, [userId, selectedViewUserId, viewableUserIds]);

  /**
   * ARGB 정수를 CSS 색상 문자열로 변환
   */
  const argbToRgba = useCallback((argb: number): string => {
    const a = ((argb >> 24) & 0xff) / 255;
    const r = (argb >> 16) & 0xff;
    const g = (argb >> 8) & 0xff;
    const b = argb & 0xff;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }, []);

  // 72 DPI point → 화면 pixel 변환 스케일
  // 캔버스 width가 용지 너비(points)에 대응되므로
  const ptToPixelX = width / paperWidthPt;
  const ptToPixelY = height / paperHeightPt;

  /**
   * 단일 스트로크 렌더링
   */
  const renderStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length === 0) return;

      ctx.save();

      // 펜 타입에 따른 스타일 설정
      const color = argbToRgba(stroke.color);
      // thickness는 mm 단위 → 72 DPI point → pixel
      const thicknessPt = stroke.thickness * MM_TO_PT;
      const thicknessMultiplier = stroke.penType === PenType.Highlighter ? 10 : 1;
      const lineWidth = thicknessPt * ptToPixelX * scale * thicknessMultiplier;

      if (stroke.penType === PenType.Highlighter) {
        ctx.globalAlpha = 0.4;
        ctx.globalCompositeOperation = 'multiply';
      } else if (stroke.penType === PenType.Eraser) {
        ctx.globalCompositeOperation = 'destination-out';
      }

      const points = stroke.points;
      const firstPoint = points[0];

      // 1포인트 스트로크: 점(원)으로 렌더링
      if (points.length === 1) {
        const px = (firstPoint.x - cropOffset.x) * ptToPixelX * scale;
        const py = (firstPoint.y - cropOffset.y) * ptToPixelY * scale;
        const radius = lineWidth / 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // 2포인트 이상: 경로 그리기 (좌표는 72 DPI point → pixel 변환, crop offset 적용)
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(
        (firstPoint.x - cropOffset.x) * ptToPixelX * scale,
        (firstPoint.y - cropOffset.y) * ptToPixelY * scale
      );

      // 베지어 곡선으로 부드럽게 연결
      for (let i = 1; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];

        // 압력 기반 선 두께 조절
        const pressureScale = current.pressure / 32767;
        ctx.lineWidth = lineWidth * (0.5 + pressureScale * 0.5);

        const midX = ((current.x + next.x) / 2 - cropOffset.x) * ptToPixelX * scale;
        const midY = ((current.y + next.y) / 2 - cropOffset.y) * ptToPixelY * scale;

        ctx.quadraticCurveTo(
          (current.x - cropOffset.x) * ptToPixelX * scale,
          (current.y - cropOffset.y) * ptToPixelY * scale,
          midX,
          midY
        );
      }

      // 마지막 점
      const lastPoint = points[points.length - 1];
      ctx.lineTo(
        (lastPoint.x - cropOffset.x) * ptToPixelX * scale,
        (lastPoint.y - cropOffset.y) * ptToPixelY * scale
      );

      ctx.stroke();
      ctx.restore();
    },
    [argbToRgba, scale, ptToPixelX, ptToPixelY, cropOffset]
  );

  /**
   * 혜성 모양 사용자 표시 (활성 스트로크용)
   * 필기 속도에 따라 꼬리 길이가 변함
   * - 속도가 빠르면 꼬리가 길어짐
   * - 속도가 0이면 꼬리가 수렴함
   */
  const renderUserIndicator = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length === 0) return;

      const points = stroke.points;

      // 스트로크 포인트를 화면 좌표로 변환 (crop offset 적용)
      const screenPoints: { x: number; y: number }[] = [];
      for (let i = Math.max(0, points.length - 50); i < points.length; i++) {
        screenPoints.push({
          x: (points[i].x - cropOffset.x) * ptToPixelX * scale,
          y: (points[i].y - cropOffset.y) * ptToPixelY * scale,
        });
      }

      if (screenPoints.length === 0) return;

      // 마지막 점 (머리)
      const head = screenPoints[screenPoints.length - 1];

      // 최근 포인트들의 거리를 계산하여 속도 추정
      // 최근 5개 포인트의 평균 거리로 속도 계산
      let recentSpeed = 0;
      const speedSampleCount = Math.min(5, screenPoints.length - 1);
      if (speedSampleCount > 0) {
        let totalDist = 0;
        for (let i = screenPoints.length - 1; i > screenPoints.length - 1 - speedSampleCount; i--) {
          const p1 = screenPoints[i];
          const p2 = screenPoints[i - 1];
          totalDist += Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
        }
        recentSpeed = totalDist / speedSampleCount;
      }

      // 속도에 따른 꼬리 길이 계산 (화면 픽셀 단위)
      // 최소 꼬리 길이 40px, 최대 120px
      const minTailLength = 40;
      const maxTailLength = 120;
      // 속도 정규화: 0.005px/point면 최소, 0.15px/point면 최대
      const speedFactor = Math.min(Math.max((recentSpeed - 0.005) / 0.145, 0), 1);
      const targetTailLength = minTailLength + (maxTailLength - minTailLength) * speedFactor;

      if (recentSpeed < 0.001) {
        // 완전히 멈춰있을 때만 머리만 그림
        ctx.save();
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.arc(head.x, head.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // 꼬리 경로를 따라 포인트 보간
      // 머리에서 시작하여 targetTailLength만큼 뒤로 가면서 점 생성
      const tailPoints: { x: number; y: number; t: number }[] = [];
      let remainingLength = targetTailLength;
      let currentIdx = screenPoints.length - 1;

      tailPoints.push({ x: head.x, y: head.y, t: 0 });

      while (remainingLength > 0 && currentIdx > 0) {
        const curr = screenPoints[currentIdx];
        const prev = screenPoints[currentIdx - 1];
        const segmentLength = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);

        if (segmentLength <= remainingLength) {
          // 전체 세그먼트 사용
          const t = 1 - (targetTailLength - remainingLength + segmentLength) / targetTailLength;
          tailPoints.push({ x: prev.x, y: prev.y, t });
          remainingLength -= segmentLength;
          currentIdx--;
        } else {
          // 세그먼트 일부만 사용 (보간)
          const ratio = remainingLength / segmentLength;
          const interpX = curr.x + (prev.x - curr.x) * ratio;
          const interpY = curr.y + (prev.y - curr.y) * ratio;
          tailPoints.push({ x: interpX, y: interpY, t: 1 });
          remainingLength = 0;
        }
      }

      ctx.save();

      // 꼬리 그리기 (그라디언트 효과)
      const tailSegments = 20;
      for (let i = 0; i < tailSegments; i++) {
        const t = i / tailSegments; // 0(머리) → 1(꼬리)

        // tailPoints에서 t 위치의 좌표 찾기
        let px = head.x, py = head.y;
        for (let j = 0; j < tailPoints.length - 1; j++) {
          const p1 = tailPoints[j];
          const p2 = tailPoints[j + 1];
          if (t >= p1.t && t <= p2.t) {
            const localT = (t - p1.t) / (p2.t - p1.t);
            px = p1.x + (p2.x - p1.x) * localT;
            py = p1.y + (p2.y - p1.y) * localT;
            break;
          }
        }

        // 머리에서 꼬리로 갈수록 작아지고 투명해짐
        const progress = 1 - t; // 1(머리) → 0(꼬리)
        const radius = 2 + progress * 5; // 2px(꼬리) → 7px(머리)
        const alpha = 0.1 + progress * 0.9; // 0.1(꼬리) → 1.0(머리)

        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 머리 부분 (꽉 찬 원)
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
    [scale, ptToPixelX, ptToPixelY, cropOffset]
  );

  /**
   * 전체 캔버스 렌더링
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 클리어 (투명 배경 - BackgroundCanvas가 배경을 담당)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 완료된 스트로크 렌더링 (필터 적용)
    const pageStrokes = getPageStrokes(pageAddress);
    pageStrokes.forEach((stroke) => {
      if (!activeStrokes.has(stroke.id) && shouldShowStroke(stroke)) {
        renderStroke(ctx, stroke);
      }
    });

    // 활성 스트로크 렌더링 (실시간, 필터 적용)
    activeStrokes.forEach((stroke) => {
      if (isSamePageAddress(stroke.pageAddress, pageAddress) && shouldShowStroke(stroke)) {
        renderStroke(ctx, stroke);
        renderUserIndicator(ctx, stroke);
      }
    });
  }, [pageAddress, getPageStrokes, activeStrokes, renderStroke, renderUserIndicator, shouldShowStroke]);

  /**
   * 애니메이션 루프
   */
  useEffect(() => {
    let isRunning = true;

    const loop = () => {
      if (!isRunning) return;
      render();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      isRunning = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  /**
   * 캔버스 크기 조정
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // DPI 스케일링
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        touchAction: 'none',
      }}
    />
  );
};

export default StrokeCanvas;
