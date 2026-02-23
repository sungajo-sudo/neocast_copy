// Phase 4: 첨삭 레이어
// 호스트가 마우스로 빨간 획을 그리면 소켓으로 게스트에게 실시간 전달
import React, { useRef, useCallback, useState } from 'react';

interface Point { x: number; y: number; }

interface AnnotationLayerProps {
    width: number;
    height: number;
    guestId: string;
    pageId: string;
    onStroke: (guestId: string, pageId: string, points: Point[]) => void;
}

const COLOR = '#FF3B30';
const LINE_WIDTH = 3;

export default function AnnotationLayer({
    width,
    height,
    guestId,
    pageId,
    onStroke,
}: AnnotationLayerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const currentPointsRef = useRef<Point[]>([]);
    const [, forceUpdate] = useState(0);

    function getPoint(e: React.MouseEvent | React.TouchEvent): Point {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            const t = e.touches[0];
            return { x: t.clientX - rect.left, y: t.clientY - rect.top };
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    }

    function drawCurrentPath(ctx: CanvasRenderingContext2D, points: Point[]) {
        if (points.length < 2) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.save();
        ctx.strokeStyle = COLOR;
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isDrawingRef.current = true;
        const pt = getPoint(e);
        currentPointsRef.current = [pt];
        forceUpdate(n => n + 1);
    }, []);

    const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        e.preventDefault();
        const pt = getPoint(e);
        currentPointsRef.current.push(pt);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        drawCurrentPath(ctx, currentPointsRef.current);
    }, []);

    const handleEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        e.preventDefault();
        isDrawingRef.current = false;

        const points = [...currentPointsRef.current];
        currentPointsRef.current = [];

        // Clear canvas (will be rendered on DemoStrokeCanvas overlay)
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        if (points.length >= 2) {
            onStroke(guestId, pageId, points);
        }
    }, [guestId, pageId, onStroke]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width,
                height,
                cursor: 'crosshair',
                touchAction: 'none',
                zIndex: 10,
            }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
        />
    );
}
