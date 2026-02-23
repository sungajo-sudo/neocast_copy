// 게스트 캔버스 뷰
// 꼐 학생이 마우스로 필기 → 소켓으로 전송
// 호스트의 첨삭(annotation:stroke) 실시간 수신 + 배지 표시
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useDemoStrokeStore } from '../stores/demoStrokeStore';
import { getStrokeSocket, getControlSocket } from '../services/socketService';
import DemoStrokeCanvas from './canvas/DemoStrokeCanvas';
import type { Stroke } from '../stores/demoStrokeStore';
import { v4 as uuidv4 } from 'uuid';

interface AnnotationStroke {
    color: string;
    lineWidth: number;
    points: { x: number; y: number }[];
}

const CANVAS_W = Math.min(window.innerWidth - 48, 800);
const CANVAS_H = Math.round(CANVAS_W * 0.65);

export default function GuestCanvas() {
    const { sessionId, userId, nickname } = useSessionStore();
    const addStroke = useDemoStrokeStore(s => s.addStroke);
    const updateActiveStroke = useDemoStrokeStore(s => s.updateActiveStroke);
    const finalizeStroke = useDemoStrokeStore(s => s.finalizeStroke);
    const getStrokes = useDemoStrokeStore(s => s.getStrokes);
    const activeStrokesMap = useDemoStrokeStore(s => s.activeStrokes);

    const [annotationStrokes, setAnnotationStrokes] = useState<AnnotationStroke[]>([]);
    const [showBadge, setShowBadge] = useState(false);
    const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const currentStrokeIdRef = useRef<string | null>(null);
    const currentPointsRef = useRef<{ x: number; y: number; pressure: number }[]>([]);

    const strokeSockRef = useRef<ReturnType<typeof getStrokeSocket> | null>(null);

    useEffect(() => {
        if (!sessionId || !userId) return;

        const strokeSock = getStrokeSocket(sessionId, userId);
        const controlSock = getControlSocket(sessionId, userId);
        strokeSockRef.current = strokeSock;

        // Receive annotation from host
        controlSock.on('annotation:stroke', (data: { points: { x: number; y: number }[] }) => {
            setAnnotationStrokes(prev => [...prev, {
                color: '#FF3B30',
                lineWidth: 3,
                points: data.points,
            }]);

            // Show badge
            setShowBadge(true);
            if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
            badgeTimerRef.current = setTimeout(() => setShowBadge(false), 3000);
        });

        return () => {
            controlSock.off('annotation:stroke');
        };
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
            color: '#1a1a1a',
            lineWidth: 2,
            points: [pt],
            done: false,
        };
        updateActiveStroke(strokeId, stroke);
        sendStrokePacket('stroke_begin', { strokeId, color: '#1a1a1a', lineWidth: 2 });
    }, [userId, updateActiveStroke, sendStrokePacket]);

    const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || !currentStrokeIdRef.current) return;
        e.preventDefault();
        const pt = getPointFromEvent(e);
        currentPointsRef.current.push(pt);

        const existing = useDemoStrokeStore.getState().activeStrokes.get(currentStrokeIdRef.current);
        if (existing) {
            updateActiveStroke(currentStrokeIdRef.current, {
                ...existing,
                points: [...existing.points, pt],
            });
        }
        sendStrokePacket('stroke_point', { strokeId: currentStrokeIdRef.current, ...pt });
    }, [updateActiveStroke, sendStrokePacket]);

    const handleEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || !currentStrokeIdRef.current) return;
        e.preventDefault();
        const strokeId = currentStrokeIdRef.current;
        isDrawingRef.current = false;
        currentStrokeIdRef.current = null;

        // Finalize + send complete packet for host history
        const stroke = useDemoStrokeStore.getState().activeStrokes.get(strokeId);
        if (stroke) {
            sendStrokePacket('stroke_complete', {
                strokeId,
                color: stroke.color,
                lineWidth: stroke.lineWidth,
                points: currentPointsRef.current,
            });
        }
        finalizeStroke(strokeId);
        currentPointsRef.current = [];
    }, [finalizeStroke, sendStrokePacket]);

    const myStrokes = getStrokes(userId ?? '');
    const myActive = Array.from(activeStrokesMap.values()).filter(s => s.userId === userId);

    return (
        <div style={container}>
            {/* Top bar */}
            <div style={topBar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.3rem' }}>✏️</span>
                    <span style={{ color: '#fff', fontWeight: 700 }}>NeoCast</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>학생 필기</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                    🧑‍🎓 {nickname}
                </div>
            </div>

            <div style={content}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: 12 }}>
                    마우스를 드래그해 필기하세요 · 선생님에게 실시간 전달됩니다
                </div>

                {/* Canvas */}
                <div
                    ref={canvasContainerRef}
                    style={{
                        position: 'relative',
                        width: CANVAS_W,
                        height: CANVAS_H,
                        background: '#fff',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        cursor: 'crosshair',
                        touchAction: 'none',
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
                        activeStrokes={myActive}
                        annotationStrokes={annotationStrokes}
                        width={CANVAS_W}
                        height={CANVAS_H}
                    />

                    {/* Annotation badge */}
                    {showBadge && (
                        <div style={badge}>
                            ✏️ 선생님 첨삭 중
                        </div>
                    )}
                </div>

                <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
                    {annotationStrokes.length > 0 && `선생님 첨삭 ${annotationStrokes.length}개 수신됨`}
                </div>
            </div>
        </div>
    );
}

const container: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0f0c29, #1a1540)',
    fontFamily: "'Inter', sans-serif",
};
const topBar: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 60,
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
};
const content: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 24px',
};
const badge: React.CSSProperties = {
    position: 'absolute', top: 12, left: 12,
    background: 'rgba(255,59,48,0.9)',
    color: '#fff', padding: '6px 14px', borderRadius: 20,
    fontSize: '0.85rem', fontWeight: 600,
    animation: 'none',
};
