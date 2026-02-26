// HostCanvas 컴포넌트 - 호스트 판서 캔버스
import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useDemoStrokeStore } from '../../stores/demoStrokeStore';
import { getStrokeSocket } from '../../services/socketService';
import DemoStrokeCanvas from '../canvas/DemoStrokeCanvas';
import type { Stroke } from '../../stores/demoStrokeStore';
import { v4 as uuidv4 } from 'uuid';

// 펜 설정
const COLORS = [
    { label: '검정', hex: '#1a1a1a' },
    { label: '빨강', hex: '#ef4444' },
    { label: '파랑', hex: '#3b82f6' },
    { label: '초록', hex: '#22c55e' },
];

// 캔버스 크기: A4 세로 비율 (1:√2 ≈ 1:1.414)
const CANVAS_W = 700;
const CANVAS_H = Math.round(CANVAS_W * Math.sqrt(2)); // A4 세로 비율 (700 × 990)

export default function HostCanvas() {
    const { sessionId, userId } = useSessionStore();
    const addStroke = useDemoStrokeStore(s => s.addStroke);
    const updateActiveStroke = useDemoStrokeStore(s => s.updateActiveStroke);
    const finalizeStroke = useDemoStrokeStore(s => s.finalizeStroke);
    const clearUserStrokes = useDemoStrokeStore(s => s.clearUserStrokes);
    const getStrokes = useDemoStrokeStore(s => s.getStrokes);
    const activeStrokesMap = useDemoStrokeStore(s => s.activeStrokes);

    const [penColor, setPenColor] = useState('#1a1a1a');
    const [lineWidth, setLineWidth] = useState(3);

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const currentStrokeIdRef = useRef<string | null>(null);
    const currentPointsRef = useRef<{ x: number; y: number; pressure: number }[]>([]);
    const strokeSockRef = useRef<ReturnType<typeof getStrokeSocket> | null>(null);

    const penColorRef = useRef(penColor);
    const lineWidthRef = useRef(lineWidth);
    useEffect(() => { penColorRef.current = penColor; }, [penColor]);
    useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);

    useEffect(() => {
        if (sessionId && userId) {
            strokeSockRef.current = getStrokeSocket(sessionId, userId);
        }
    }, [sessionId, userId]);

    function getPointFromEvent(e: React.MouseEvent | React.TouchEvent): { x: number; y: number; pressure: number } {
        const container = canvasContainerRef.current;
        if (!container) return { x: 0, y: 0, pressure: 0.5 };
        const rect = container.getBoundingClientRect();
        if ('touches' in e) {
            const t = e.touches[0] || e.changedTouches[0];
            return { x: t.clientX - rect.left, y: t.clientY - rect.top, pressure: 0.5 };
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top, pressure: 0.5 };
    }

    const sendStrokePacket = useCallback((type: string, payload: object) => {
        strokeSockRef.current?.emit('stroke', new TextEncoder().encode(JSON.stringify({ type, ...payload })));
    }, []);

    const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isDrawingRef.current = true;
        const strokeId = uuidv4();
        currentStrokeIdRef.current = strokeId;
        const pt = getPointFromEvent(e);
        currentPointsRef.current = [pt];

        const stroke: Stroke = {
            id: strokeId,
            userId: userId!,
            color: penColorRef.current,
            lineWidth: lineWidthRef.current,
            points: [pt],
            done: false,
        };
        updateActiveStroke(strokeId, stroke);
        sendStrokePacket('stroke_begin', { strokeId, color: penColorRef.current, lineWidth: lineWidthRef.current });
    }, [userId, updateActiveStroke, sendStrokePacket]);

    const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || !currentStrokeIdRef.current) return;
        e.preventDefault();
        const pt = getPointFromEvent(e);
        currentPointsRef.current.push(pt);
        const existing = useDemoStrokeStore.getState().activeStrokes.get(currentStrokeIdRef.current);
        if (existing) {
            updateActiveStroke(currentStrokeIdRef.current, { ...existing, points: [...existing.points, pt] });
        }
        sendStrokePacket('stroke_point', { strokeId: currentStrokeIdRef.current, ...pt });
    }, [updateActiveStroke, sendStrokePacket]);

    const handleEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || !currentStrokeIdRef.current) return;
        e.preventDefault();
        const strokeId = currentStrokeIdRef.current;
        isDrawingRef.current = false;
        currentStrokeIdRef.current = null;
        const stroke = useDemoStrokeStore.getState().activeStrokes.get(strokeId);
        if (stroke) {
            sendStrokePacket('stroke_complete', {
                strokeId,
                color: stroke.color,
                lineWidth: stroke.lineWidth,
                points: currentPointsRef.current,
            });

            // 🧪 로컬 모드: localStorage에 호스트 스트로크 저장
            if (sessionId && userId) {
                const strokeKey = `nc_strokes_${sessionId}_${userId}`;
                const strokes = JSON.parse(localStorage.getItem(strokeKey) || '[]');
                const newStroke = {
                    id: strokeId,
                    userId,
                    color: stroke.color,
                    lineWidth: stroke.lineWidth,
                    points: currentPointsRef.current,
                    timestamp: Date.now(),
                    done: true
                };
                strokes.push(newStroke);
                localStorage.setItem(strokeKey, JSON.stringify(strokes));
            }
        }
        finalizeStroke(strokeId);
        currentPointsRef.current = [];
    }, [finalizeStroke, sendStrokePacket, sessionId, userId]);

    const handleClearCanvas = useCallback(() => {
        if (!userId || !sessionId) return;
        if (!confirm('캔버스의 모든 필기를 지우시겠습니까?')) return;

        // 스토어에서 지우기
        clearUserStrokes(userId);

        // localStorage에서도 지우기
        const strokeKey = `nc_strokes_${sessionId}_${userId}`;
        localStorage.removeItem(strokeKey);

        console.log('[HostCanvas] Canvas cleared');
    }, [userId, sessionId, clearUserStrokes]);

    const myStrokes = getStrokes(userId ?? '');
    const myActiveStrokes = Array.from(activeStrokesMap.values()).filter(s => s.userId === userId);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 펜 컨트롤 */}
            <div style={{
                display: 'flex',
                gap: 8,
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 12,
                alignItems: 'center',
            }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>펜 색상:</span>
                {COLORS.map(c => (
                    <button
                        key={c.hex}
                        onClick={() => setPenColor(c.hex)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: c.hex,
                            border: penColor === c.hex ? '3px solid #3b82f6' : '2px solid rgba(0,0,0,0.1)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        title={c.label}
                    />
                ))}
                <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)', margin: '0 8px' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>굵기:</span>
                {[1.5, 3, 6].map(w => (
                    <button
                        key={w}
                        onClick={() => setLineWidth(w)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: lineWidth === w ? '#3b82f6' : 'rgba(0,0,0,0.05)',
                            border: lineWidth === w ? '2px solid #2563eb' : '2px solid rgba(0,0,0,0.1)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: lineWidth === w ? '#fff' : '#64748b',
                        }}
                    >
                        {w === 1.5 ? 'S' : w === 3 ? 'M' : 'L'}
                    </button>
                ))}
                <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)', margin: '0 8px' }} />
                <button
                    onClick={handleClearCanvas}
                    style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#dc2626',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.15)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                    title="캔버스 지우기"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 6h18M19 6l-1 14H6L5 6m5 0V4h4v2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    지우기
                </button>
            </div>

            {/* 캔버스 */}
            <div
                ref={canvasContainerRef}
                style={{
                    position: 'relative',
                    width: CANVAS_W,
                    height: CANVAS_H,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.12)'
                }}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
            >
                <DemoStrokeCanvas
                    strokes={myStrokes}
                    activeStrokes={myActiveStrokes}
                    annotationStrokes={[]}
                    width={CANVAS_W}
                    height={CANVAS_H}
                />
            </div>
        </div>
    );
}
