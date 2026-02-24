// GuestCanvas — 게스트(학생) 세션 화면 (neocast UI 이식)
// 레이아웃: MonitoringView와 동일한 수채화BG + 상단바 + 좌측툴바 + 하단 컨트롤바
// 소켓/스트로크 로직은 기존과 동일
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useDemoStrokeStore } from '../stores/demoStrokeStore';
import { getStrokeSocket, getControlSocket } from '../services/socketService';
import DemoStrokeCanvas from './canvas/DemoStrokeCanvas';
import type { Stroke } from '../stores/demoStrokeStore';
import { v4 as uuidv4 } from 'uuid';
import watercolorBg from '../assets/watercolor-bg.png';

// ─── 펜 설정 상수 ──────────────────────────────────────────
const COLORS = [
    { label: '검정', hex: '#1a1a1a' },
    { label: '빨강', hex: '#ef4444' },
    { label: '파랑', hex: '#3b82f6' },
    { label: '초록', hex: '#22c55e' },
    { label: '노랑', hex: '#eab308' },
    { label: '주황', hex: '#f97316' },
    { label: '보라', hex: '#a855f7' },
    { label: '분홍', hex: '#ec4899' },
];

const THICKNESSES: { label: string; px: number }[] = [
    { label: '얇게', px: 1.5 },
    { label: '보통', px: 3 },
    { label: '굵게', px: 6 },
    { label: '굵굵', px: 10 },
];

type PenType = 'pen' | 'highlighter' | 'eraser';

interface AnnotationStroke {
    color: string;
    lineWidth: number;
    points: { x: number; y: number }[];
}

function getStrokeProps(type: PenType, color: string, lineWidth: number): { color: string; lineWidth: number } {
    if (type === 'eraser') return { color: '#ffffff', lineWidth: lineWidth * 4 };
    if (type === 'highlighter') {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return { color: `rgba(${r},${g},${b},0.4)`, lineWidth: lineWidth * 2.5 };
    }
    return { color, lineWidth };
}

// ─── 하단 컨트롤 바 버튼 컴포넌트 (MonitoringView와 동일) ─
interface CtrlBtnProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    activeColor?: string;
    danger?: boolean;
    badge?: number;
    disabled?: boolean;
    hasDropdown?: boolean;
    onClick?: () => void;
}
function CtrlBtn({ icon, label, active, activeColor = '#facc15', danger, badge, disabled, hasDropdown, onClick }: CtrlBtnProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, minWidth: 56, padding: '6px 8px',
                background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
                borderRadius: 8, transition: 'background 0.15s',
                opacity: disabled ? 0.4 : 1,
                position: 'relative',
            }}
            onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
                <div style={{ color: active ? activeColor : danger ? '#f87171' : 'rgba(255,255,255,0.85)', fontSize: '1.2rem', lineHeight: 1 }}>
                    {icon}
                </div>
                {hasDropdown && (
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', marginTop: 2 }}>▾</span>
                )}
                {badge !== undefined && badge > 0 && (
                    <div style={{
                        position: 'absolute', top: -6, right: hasDropdown ? 8 : -6,
                        background: '#6366f1', color: '#fff',
                        fontSize: '0.6rem', fontWeight: 700,
                        minWidth: 16, height: 16, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px',
                    }}>
                        {badge}
                    </div>
                )}
            </div>
            <span style={{
                fontSize: '0.62rem', fontWeight: 500,
                color: active ? activeColor : danger ? '#f87171' : 'rgba(255,255,255,0.6)',
                letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            }}>
                {label}
            </span>
        </button>
    );
}

function Divider() {
    return <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.15)', margin: '0 4px', flexShrink: 0 }} />;
}

// ─── 아이콘 (MonitoringView와 동일) ──────────────────────
const IcoPen = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
const IcoTouch = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0"/><path d="M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2"/><path d="M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8"/><path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/></svg>;
const IcoMic = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IcoPages = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IcoUpload = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>;
const IcoFolder = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>;
const IcoPeople = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const IcoChat = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const IcoSettings = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const IcoMore = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;
const IcoLeave = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoStudent = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>;

export default function GuestCanvas() {
    const navigate = useNavigate();
    const { sessionId, userId, nickname } = useSessionStore();
    const addStroke = useDemoStrokeStore(s => s.addStroke);
    const updateActiveStroke = useDemoStrokeStore(s => s.updateActiveStroke);
    const finalizeStroke = useDemoStrokeStore(s => s.finalizeStroke);
    const clearUserStrokes = useDemoStrokeStore(s => s.clearUserStrokes);
    const getStrokes = useDemoStrokeStore(s => s.getStrokes);
    const activeStrokesMap = useDemoStrokeStore(s => s.activeStrokes);

    const [annotationStrokes, setAnnotationStrokes] = useState<AnnotationStroke[]>([]);
    const [showBadge, setShowBadge] = useState(false);

    // 펜 설정 state
    const [penType, setPenType] = useState<PenType>('pen');
    const [penColor, setPenColor] = useState('#1a1a1a');
    const [lineWidth, setLineWidth] = useState(3);

    // 컨트롤바 토글 상태
    const [micOn, setMicOn] = useState(false);
    const [touchPaused, setTouchPaused] = useState(false);

    const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const currentStrokeIdRef = useRef<string | null>(null);
    const currentPointsRef = useRef<{ x: number; y: number; pressure: number }[]>([]);
    const strokeSockRef = useRef<ReturnType<typeof getStrokeSocket> | null>(null);

    // ref로 클로저 문제 방지
    const penTypeRef = useRef(penType);
    const penColorRef = useRef(penColor);
    const lineWidthRef = useRef(lineWidth);
    useEffect(() => { penTypeRef.current = penType; }, [penType]);
    useEffect(() => { penColorRef.current = penColor; }, [penColor]);
    useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);

    // ── 소켓 연결 (기존 로직 유지) ──────────────────────────
    useEffect(() => {
        if (!sessionId || !userId) return;
        const strokeSock = getStrokeSocket(sessionId, userId);
        const controlSock = getControlSocket(sessionId, userId);
        strokeSockRef.current = strokeSock;

        controlSock.on('annotation:stroke', (data: { points: { x: number; y: number }[] }) => {
            setAnnotationStrokes(prev => [...prev, { color: '#FF3B30', lineWidth: 3, points: data.points }]);
            setShowBadge(true);
            if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
            badgeTimerRef.current = setTimeout(() => setShowBadge(false), 3000);
        });

        return () => { controlSock.off('annotation:stroke'); };
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

        const props = getStrokeProps(penTypeRef.current, penColorRef.current, lineWidthRef.current);
        const stroke: Stroke = {
            id: strokeId, userId: userId!,
            color: props.color, lineWidth: props.lineWidth,
            points: [pt], done: false,
        };
        updateActiveStroke(strokeId, stroke);
        sendStrokePacket('stroke_begin', { strokeId, color: props.color, lineWidth: props.lineWidth });
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
                strokeId, color: stroke.color, lineWidth: stroke.lineWidth,
                points: currentPointsRef.current,
            });
        }
        finalizeStroke(strokeId);
        currentPointsRef.current = [];
    }, [finalizeStroke, sendStrokePacket]);

    function handleClear() {
        if (userId) clearUserStrokes(userId);
        setAnnotationStrokes([]);
    }

    function handleLeave() {
        if (confirm('세션에서 나가시겠습니까?')) navigate('/join');
    }

    const myStrokes = getStrokes(userId ?? '');
    const myActive = Array.from(activeStrokesMap.values()).filter(s => s.userId === userId);
    const canvasCursor = penType === 'eraser' ? 'cell' : 'crosshair';

    // 캔버스 크기: 툴바(64px) 제외한 영역에 맞춤
    const CANVAS_W = Math.min(window.innerWidth - 64 - 80, 900);
    const CANVAS_H = Math.round(CANVAS_W * 0.65);

    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', -apple-system, sans-serif",
            position: 'relative', overflow: 'hidden',
        }}>
            {/* 수채화 배경 */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 0,
                backgroundImage: `url(${watercolorBg})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                opacity: 0.55,
            }} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'rgba(255,255,255,0.35)' }} />

            {/* ─── 상단 바 ─── */}
            <header style={{
                position: 'relative', zIndex: 20, flexShrink: 0,
                height: 52,
                background: 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                display: 'flex', alignItems: 'center',
                padding: '0 16px', gap: 8,
            }}>
                {/* 로고 */}
                <div style={{ display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: '1.05rem', marginRight: 8 }}>
                    <span style={{ background: 'linear-gradient(90deg,#2563eb,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Neo</span>
                    <span style={{ color: '#1e293b' }}>CAST</span>
                </div>

                <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.12)', margin: '0 4px' }} />

                {/* Undo/Redo/Clear */}
                {[
                    { title: '실행취소', action: undefined as (() => void) | undefined, svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg> },
                    { title: '다시실행', action: undefined as (() => void) | undefined, svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg> },
                    { title: '페이지 지우기', action: handleClear, svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><path d="M3 6h18M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg> },
                ].map(btn => (
                    <button key={btn.title} title={btn.title} onClick={btn.action} style={{
                        width: 28, height: 28, borderRadius: '50%',
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: 'rgba(255,255,255,0.8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#374151',
                    }}>
                        {btn.svg}
                    </button>
                ))}

                <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.12)', margin: '0 4px' }} />

                {/* A4 선택 */}
                <button style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 6,
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: 'rgba(255,255,255,0.8)',
                    cursor: 'pointer', fontSize: '0.78rem', color: '#374151', fontWeight: 600,
                }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    A4
                    <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>▾</span>
                </button>

                {/* 현재 펜 색상 도트 */}
                <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: penType === 'eraser' ? '#e5e7eb' : penColor,
                    border: '2px solid rgba(255,255,255,0.9)',
                    boxShadow: '0 0 0 1.5px rgba(0,0,0,0.2)',
                    flexShrink: 0,
                }} />

                {/* 스페이서 */}
                <div style={{ flex: 1 }} />

                {/* 우측: 100% + 언어 + 닉네임 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 6,
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: 'rgba(255,255,255,0.8)',
                        fontSize: '0.75rem', color: '#374151', fontWeight: 600, cursor: 'pointer',
                    }}>
                        100%
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    </button>

                    <button style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 6,
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: 'rgba(255,255,255,0.8)',
                        fontSize: '0.75rem', color: '#374151', fontWeight: 500, cursor: 'pointer',
                    }}>
                        🇰🇷 한국어 <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>▾</span>
                    </button>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(255,255,255,0.8)',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: 20, padding: '3px 10px 3px 4px',
                    }}>
                        <div style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                        }}>
                            {(nickname ?? '?').charAt(0)}
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>{nickname}</span>
                    </div>
                </div>
            </header>

            {/* ─── 메인 콘텐츠 ─── */}
            <main style={{
                flex: 1, position: 'relative', zIndex: 10,
                overflow: 'hidden', display: 'flex',
            }}>
                {/* 왼쪽 툴바 */}
                <div style={{
                    width: 64, flexShrink: 0,
                    background: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(12px)',
                    borderRight: '1px solid rgba(0,0,0,0.08)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '12px 6px', gap: 6, overflowY: 'auto',
                    zIndex: 1,
                }}>
                    {/* 도구 선택 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: '100%' }}>
                        {([
                            { type: 'pen' as PenType, icon: '✏️', label: '펜' },
                            { type: 'highlighter' as PenType, icon: '🖌', label: '형광' },
                            { type: 'eraser' as PenType, icon: '◻', label: '지우개' },
                        ] as { type: PenType; icon: string; label: string }[]).map(tool => (
                            <button
                                key={tool.type}
                                onClick={() => setPenType(tool.type)}
                                title={tool.label}
                                style={{
                                    width: '100%',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    padding: '5px 4px', borderRadius: 8, cursor: 'pointer',
                                    transition: 'all 0.13s',
                                    background: penType === tool.type ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.03)',
                                    border: `1px solid ${penType === tool.type ? 'rgba(99,102,241,0.4)' : 'rgba(0,0,0,0.06)'}`,
                                    color: penType === tool.type ? '#6366f1' : '#374151',
                                }}
                            >
                                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{tool.icon}</span>
                                <span style={{ fontSize: '0.6rem', marginTop: 2 }}>{tool.label}</span>
                            </button>
                        ))}
                    </div>

                    <div style={{ width: '75%', height: 1, background: 'rgba(0,0,0,0.08)', margin: '2px 0' }} />

                    {/* 색상 (eraser 아닐 때) */}
                    {penType !== 'eraser' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: '100%' }}>
                            {COLORS.map(c => (
                                <button
                                    key={c.hex}
                                    onClick={() => setPenColor(c.hex)}
                                    title={c.label}
                                    style={{
                                        width: 22, height: 22, borderRadius: '50%',
                                        background: c.hex,
                                        border: penColor === c.hex ? '2px solid #fff' : '2px solid transparent',
                                        outline: penColor === c.hex ? '2px solid rgba(99,102,241,0.9)' : 'none',
                                        cursor: 'pointer',
                                        transform: penColor === c.hex ? 'scale(1.25)' : 'scale(1)',
                                        transition: 'all 0.12s', flexShrink: 0,
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    <div style={{ width: '75%', height: 1, background: 'rgba(0,0,0,0.08)', margin: '2px 0' }} />

                    {/* 두께 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: '100%' }}>
                        {THICKNESSES.map(t => {
                            const dotColor = penType === 'eraser' ? '#888' : penColor;
                            const dotSize = Math.max(4, Math.min(18, t.px * 2));
                            return (
                                <button
                                    key={t.px}
                                    onClick={() => setLineWidth(t.px)}
                                    title={t.label}
                                    style={{
                                        width: '100%',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        padding: '5px 4px', borderRadius: 8, cursor: 'pointer',
                                        transition: 'all 0.13s',
                                        background: lineWidth === t.px ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.03)',
                                        border: `1px solid ${lineWidth === t.px ? 'rgba(99,102,241,0.4)' : 'rgba(0,0,0,0.06)'}`,
                                    }}
                                >
                                    <div style={{
                                        width: dotSize, height: dotSize, borderRadius: '50%',
                                        background: dotColor,
                                        opacity: penType === 'highlighter' ? 0.5 : 1,
                                    }} />
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ width: '75%', height: 1, background: 'rgba(0,0,0,0.08)', margin: '2px 0' }} />

                    {/* 전체 지우기 */}
                    <button
                        onClick={handleClear}
                        title="전체 지우기"
                        style={{
                            width: '100%',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '5px 4px', borderRadius: 8, cursor: 'pointer',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: '#ef4444',
                        }}
                    >
                        <span style={{ fontSize: '1rem', lineHeight: 1 }}>🗑</span>
                        <span style={{ fontSize: '0.58rem', marginTop: 2 }}>전체삭제</span>
                    </button>
                </div>

                {/* 캔버스 패널 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* 페이지 탭 */}
                    <div style={{ display: 'flex', padding: '8px 16px 0', gap: 4, flexShrink: 0 }}>
                        <div style={{
                            background: 'rgba(255,255,255,0.85)',
                            border: '1px solid rgba(0,0,0,0.1)',
                            borderBottom: '1px solid rgba(255,255,255,0.85)',
                            borderRadius: '6px 6px 0 0',
                            padding: '4px 14px',
                            fontSize: '0.75rem', fontWeight: 600, color: '#374151',
                        }}>
                            필기 페이지
                        </div>
                    </div>

                    {/* 캔버스 콘텐츠 */}
                    <div style={{
                        flex: 1, overflow: 'auto',
                        background: 'rgba(255,255,255,0.55)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        margin: '0 16px',
                        borderRadius: '0 6px 6px 6px',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                    }}>
                        <div style={{ color: 'rgba(100,116,139,0.7)', fontSize: '0.78rem', marginBottom: 12 }}>
                            마우스를 드래그해 필기하세요 · 선생님에게 실시간 전달됩니다
                        </div>

                        <div
                            ref={canvasContainerRef}
                            style={{
                                position: 'relative',
                                width: CANVAS_W, height: CANVAS_H,
                                background: '#fff',
                                borderRadius: 12, overflow: 'hidden',
                                boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
                                cursor: canvasCursor,
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
                            {showBadge && (
                                <div style={{
                                    position: 'absolute', top: 12, left: 12,
                                    background: 'rgba(255,59,48,0.9)',
                                    color: '#fff', padding: '6px 14px',
                                    borderRadius: 20, fontSize: '0.85rem', fontWeight: 600,
                                }}>
                                    ✏️ 선생님 첨삭 중
                                </div>
                            )}
                        </div>

                        {annotationStrokes.length > 0 && (
                            <div style={{ marginTop: 10, color: 'rgba(100,116,139,0.6)', fontSize: '0.75rem' }}>
                                선생님 첨삭 {annotationStrokes.length}개 수신됨
                            </div>
                        )}
                    </div>
                    <div style={{ height: 8, flexShrink: 0 }} />
                </div>
            </main>

            {/* ─── 하단 컨트롤 바 ─── */}
            <div style={{
                position: 'relative', zIndex: 20, flexShrink: 0,
                background: 'rgba(15,12,41,0.92)',
                backdropFilter: 'blur(16px)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 16px 6px',
            }}>
                {/* 왼쪽 버튼 그룹 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CtrlBtn icon={<IcoPen />} label="스마트펜" />
                    <CtrlBtn
                        icon={<IcoTouch />}
                        label="터치 일시중지"
                        active={touchPaused}
                        activeColor="#60a5fa"
                        onClick={() => setTouchPaused(v => !v)}
                    />
                    <CtrlBtn
                        icon={<IcoMic />}
                        label={micOn ? '음소거' : '음소거 해제'}
                        active={micOn}
                        activeColor="#34d399"
                        hasDropdown
                        onClick={() => setMicOn(v => !v)}
                    />

                    <Divider />

                    <CtrlBtn icon={<IcoPages />} label="페이지" />
                    <CtrlBtn icon={<IcoUpload />} label="업로드" />
                    <CtrlBtn icon={<IcoFolder />} label="내 자료" />

                    <Divider />

                    <CtrlBtn
                        icon={<IcoStudent />}
                        label="게스트"
                        active={true}
                        activeColor="#60a5fa"
                    />
                    <CtrlBtn icon={<IcoPeople />} label="참가자" />
                    <CtrlBtn icon={<IcoChat />} label="채팅" disabled />

                    <Divider />

                    <CtrlBtn icon={<IcoSettings />} label="설정" />
                    <CtrlBtn icon={<IcoMore />} label="더보기" />
                </div>

                {/* 오른쪽: 나가기 */}
                <CtrlBtn icon={<IcoLeave />} label="나가기" danger onClick={handleLeave} />
            </div>
        </div>
    );
}
