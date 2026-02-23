// 데모용 경량 StrokeCanvas
// 기존 StrokeCanvas.tsx의 복잡한 의존성 없이 순수 Canvas 2D API로 구현
import React, { useRef, useEffect, useCallback } from 'react';
import type { Stroke } from '../../stores/demoStrokeStore';

interface DemoStrokeCanvasProps {
    strokes: Stroke[];
    activeStrokes?: Stroke[];
    annotationStrokes?: { color: string; lineWidth: number; points: { x: number; y: number }[] }[];
    width: number;
    height: number;
    style?: React.CSSProperties;
}

export default function DemoStrokeCanvas({
    strokes,
    activeStrokes = [],
    annotationStrokes = [],
    width,
    height,
    style,
}: DemoStrokeCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number | null>(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawStrokes = (arr: Stroke[]) => {
            arr.forEach(stroke => {
                if (stroke.points.length < 2) return;
                ctx.save();
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.lineWidth * dpr;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(stroke.points[0].x * dpr, stroke.points[0].y * dpr);
                for (let i = 1; i < stroke.points.length - 1; i++) {
                    const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
                    const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(
                        stroke.points[i].x * dpr,
                        stroke.points[i].y * dpr,
                        midX * dpr,
                        midY * dpr
                    );
                }
                const last = stroke.points[stroke.points.length - 1];
                ctx.lineTo(last.x * dpr, last.y * dpr);
                ctx.stroke();
                ctx.restore();
            });
        };

        drawStrokes(strokes);
        drawStrokes(activeStrokes);

        // Annotation overlay
        annotationStrokes.forEach(ann => {
            if (ann.points.length < 2) return;
            ctx.save();
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = ann.lineWidth * dpr;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.moveTo(ann.points[0].x * dpr, ann.points[0].y * dpr);
            for (let i = 1; i < ann.points.length; i++) {
                ctx.lineTo(ann.points[i].x * dpr, ann.points[i].y * dpr);
            }
            ctx.stroke();
            ctx.restore();
        });
    }, [strokes, activeStrokes, annotationStrokes]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
    }, [width, height]);

    useEffect(() => {
        const loop = () => {
            draw();
            rafRef.current = requestAnimationFrame(loop);
        };
        loop();
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [draw]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width, height, ...style }}
        />
    );
}
