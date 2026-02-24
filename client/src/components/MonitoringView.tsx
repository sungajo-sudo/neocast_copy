// MonitoringView — 호스트 세션 화면 (Session 8-2)
// 레이아웃: neocast 판서 화면 이식 (상단바 + 수채화BG + 그리드 + 하단 컨트롤바)
// 소켓/스트로크 로직은 기존과 동일
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useDemoStrokeStore } from '../stores/demoStrokeStore';
import { getStrokeSocket, getControlSocket } from '../services/socketService';
import StudentMiniCanvas from './StudentMiniCanvas';
import StudentDetailView from './StudentDetailView';
import SmartpenButton from './control-bar/SmartpenButton';
import PdfUploadButton from './control-bar/PdfUploadButton';
import PdfUploadModal from './layout/PdfUploadModal';
import HostCanvas from './host-canvas/HostCanvas';
import { usePanelStore } from '../stores/panel-store';
import { usePageStore } from '../stores/page-store';
import type { Stroke } from '../stores/demoStrokeStore';
import watercolorBg from '../assets/watercolor-bg.png';

interface Participant {
    userId: string;
    nickname: string;
    role: 'host' | 'guest';
}

interface AnnotationStroke {
    color: string;
    lineWidth: number;
    points: { x: number; y: number }[];
}

const annotationsMap = new Map<string, AnnotationStroke[]>();

// ─── 하단 컨트롤 바 버튼 컴포넌트 ───────────────────────────
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

// ─── 아이콘 ────────────────────────────────────────────────
const IcoPen = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
const IcoTouch = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0"/><path d="M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2"/><path d="M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8"/><path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/></svg>;
const IcoMic = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IcoPages = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IcoUpload = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>;
const IcoFolder = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>;
const IcoCrown = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
const IcoPeople = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const IcoChat = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const IcoSettings = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const IcoMore = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;
const IcoLeave = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;

export default function MonitoringView() {
    const navigate = useNavigate();
    const { sessionId, userId, nickname, code } = useSessionStore();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedGuest, setSelectedGuest] = useState<Participant | null>(null);
    const [annotatingGuestId, setAnnotatingGuestId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'grid' | 'myCanvas'>('grid');
    const [, forceUpdate] = useState(0);

    // 컨트롤바 토글 상태
    const isPdfUploadOpen = usePanelStore(s => s.isPdfUploadOpen);
    const isMicOn = usePanelStore(s => s.isMicOn);
    const toggleMic = usePanelStore(s => s.toggleMic);
    const isPenStreamOn = usePanelStore(s => s.isPenStreamOn);
    const togglePenStream = usePanelStore(s => s.togglePenStream);
    const [touchPaused, setTouchPaused] = useState(false);

    // 첫 페이지 초기화
    const initializeFirstPage = usePageStore(s => s.initializeFirstPage);
    useEffect(() => { initializeFirstPage(); }, []);

    const addStroke = useDemoStrokeStore(s => s.addStroke);
    const updateActiveStroke = useDemoStrokeStore(s => s.updateActiveStroke);
    const finalizeStroke = useDemoStrokeStore(s => s.finalizeStroke);
    // strokes 상태를 직접 구독 → addStroke 시 리렌더링 트리거
    const allStrokes = useDemoStrokeStore(s => s.strokes);
    const activeStrokesMap = useDemoStrokeStore(s => s.activeStrokes);

    const controlSocketRef = useRef<ReturnType<typeof getControlSocket> | null>(null);

    // ── 소켓 연결 (기존 로직 유지) ──────────────────────────
    useEffect(() => {
        if (!sessionId || !userId) return;

        const strokeSock = getStrokeSocket(sessionId, userId);
        const controlSock = getControlSocket(sessionId, userId);
        controlSocketRef.current = controlSock;

        controlSock.on('control', (msg: { type: string; userId: string; userName: string; role: string }) => {
            if (msg.type === 'PARTICIPANT_JOIN') {
                setParticipants(prev => {
                    if (prev.find(p => p.userId === msg.userId)) return prev;
                    return [...prev, { userId: msg.userId, nickname: msg.userName, role: msg.role as 'host' | 'guest' }];
                });
            } else if (msg.type === 'PARTICIPANT_LEAVE') {
                setParticipants(prev => prev.filter(p => p.userId !== msg.userId));
            }
        });

        strokeSock.on('stroke', (data: ArrayBuffer | Buffer) => {
            try {
                const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
                if (buf.length < 33) return;

                const senderIdBytes = buf.slice(0, 32);
                const senderId = new TextDecoder().decode(senderIdBytes).replace(/\0/g, '');
                const strokeBuf = buf.slice(32);

                try {
                    const json = JSON.parse(new TextDecoder().decode(strokeBuf));
                    if (json && json.type === 'stroke_begin') {
                        updateActiveStroke(json.strokeId, {
                            id: json.strokeId, userId: senderId,
                            color: json.color ?? '#1a1a1a', lineWidth: json.lineWidth ?? 2,
                            points: [], done: false,
                        });
                    } else if (json && json.type === 'stroke_point') {
                        // stale closure 방지: getState()로 최신 상태 직접 접근
                        const existing = useDemoStrokeStore.getState().activeStrokes.get(json.strokeId);
                        if (existing) {
                            updateActiveStroke(json.strokeId, {
                                ...existing,
                                points: [...existing.points, { x: json.x, y: json.y, pressure: json.pressure ?? 0.5 }],
                            });
                        }
                    } else if (json && json.type === 'stroke_end') {
                        finalizeStroke(json.strokeId);
                    } else if (json && json.type === 'stroke_complete') {
                        const stroke: Stroke = {
                            id: json.strokeId, userId: senderId,
                            color: json.color ?? '#1a1a1a', lineWidth: json.lineWidth ?? 2,
                            points: json.points ?? [], done: true,
                        };
                        addStroke(senderId, stroke);
                    }
                } catch { /* non-JSON binary skip */ }
            } catch (err) {
                console.warn('stroke parse error', err);
            }
        });

        return () => {
            strokeSock.off('stroke');
            controlSock.off('control');
        };
    }, [sessionId, userId]); // store 메서드는 안정적(stable)이므로 deps 불필요, activeStrokesMap은 getState()로 접근

    const handleAnnotationStroke = useCallback((guestId: string, _pageId: string, points: { x: number; y: number }[]) => {
        setAnnotatingGuestId(guestId);
        const arr = annotationsMap.get(guestId) ?? [];
        arr.push({ color: '#FF3B30', lineWidth: 3, points });
        annotationsMap.set(guestId, arr);
        forceUpdate(n => n + 1);
        controlSocketRef.current?.emit('annotation:stroke', { guestId, pageId: 'page-1', points });
        setTimeout(() => setAnnotatingGuestId(null), 3000);
    }, []);

    function handleLeave() {
        if (confirm('세션을 종료하고 나가시겠습니까?')) navigate('/host');
    }

    const guests = participants.filter(p => p.role === 'guest');

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
                    { title: '실행취소', svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg> },
                    { title: '다시실행', svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg> },
                    { title: '페이지 지우기', svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><path d="M3 6h18M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg> },
                ].map(btn => (
                    <button key={btn.title} title={btn.title} style={{
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

                {/* 펜 색상 도트 */}
                <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#1a1a1a',
                    border: '2px solid rgba(255,255,255,0.9)',
                    boxShadow: '0 0 0 1.5px rgba(0,0,0,0.2)',
                }} />

                {/* 세션 코드 배지 */}
                <div style={{
                    marginLeft: 8,
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 8, padding: '3px 10px',
                }}>
                    <span style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 600 }}>코드</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#4338ca', letterSpacing: '0.15em', fontFamily: 'monospace' }}>{code}</span>
                </div>

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
                            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                        }}>
                            {(nickname ?? '?').charAt(0)}
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>{nickname}</span>
                    </div>
                </div>
            </header>

            {/* ─── 메인 콘텐츠 (그리드) ─── */}
            <main style={{ flex: 1, position: 'relative', zIndex: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Page 탭 */}
                <div style={{
                    display: 'flex', padding: '8px 16px 0',
                    gap: 4, flexShrink: 0,
                }}>
                    {[
                        { id: 'grid' as const, label: `참가자 그리드${guests.length > 0 ? ` (${guests.length}명)` : ''}` },
                        { id: 'myCanvas' as const, label: '✏️ 내 캔버스' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                            background: activeTab === tab.id ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                            border: '1px solid rgba(0,0,0,0.1)',
                            borderBottom: activeTab === tab.id ? '1px solid rgba(255,255,255,0.85)' : '1px solid rgba(0,0,0,0.08)',
                            borderRadius: '6px 6px 0 0',
                            padding: '4px 14px',
                            fontSize: '0.75rem', fontWeight: 600,
                            color: activeTab === tab.id ? '#374151' : '#94a3b8',
                            cursor: 'pointer',
                        }}>{tab.label}</button>
                    ))}
                </div>

                {/* 탭 콘텐츠 영역 */}
                <div style={{
                    flex: 1, overflow: 'auto',
                    background: 'rgba(255,255,255,0.55)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    margin: '0 16px',
                    borderRadius: '0 6px 6px 6px',
                    padding: '20px',
                }}>
                {activeTab === 'myCanvas' && <HostCanvas />}
                {activeTab === 'grid' && <>
                    {guests.length === 0 ? (
                        <div style={{
                            height: '100%', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 300,
                        }}>
                            <div style={{ fontSize: '3rem' }}>🧑‍🎓</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>
                                학생이 세션에 참가하면 여기에 표시됩니다
                            </div>
                            <div style={{
                                background: 'rgba(99,102,241,0.08)',
                                border: '1px solid rgba(99,102,241,0.2)',
                                borderRadius: 10, padding: '8px 20px',
                                fontSize: '0.85rem', color: '#6366f1',
                            }}>
                                입장 코드: <strong style={{ letterSpacing: '0.15em', fontFamily: 'monospace' }}>{code}</strong>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                            {guests.map(p => {
                                const strokes = allStrokes.get(p.userId) ?? [];
                                const active = Array.from(activeStrokesMap.values()).filter(s => s.userId === p.userId);
                                return (
                                    <StudentMiniCanvas
                                        key={p.userId}
                                        userId={p.userId}
                                        nickname={p.nickname}
                                        strokes={strokes}
                                        activeStrokes={active}
                                        isAnnotating={annotatingGuestId === p.userId}
                                        onClick={() => setSelectedGuest(p)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </>}
                </div>
                <div style={{ height: 8, flexShrink: 0 }} />
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
                    {/* 펜 그룹 */}
                    <SmartpenButton />
                    <CtrlBtn
                        icon={<IcoTouch />}
                        label="터치 일시중지"
                        active={!isPenStreamOn}
                        activeColor="#60a5fa"
                        onClick={togglePenStream}
                    />
                    <CtrlBtn
                        icon={<IcoMic />}
                        label={isMicOn ? '음소거' : '음소거 해제'}
                        active={isMicOn}
                        activeColor="#34d399"
                        hasDropdown
                        onClick={toggleMic}
                    />

                    <Divider />

                    {/* 문서 그룹 */}
                    <CtrlBtn icon={<IcoPages />} label="페이지" />
                    <PdfUploadButton />
                    <CtrlBtn icon={<IcoFolder />} label="내 자료" />

                    <Divider />

                    {/* 세션/소통 그룹 */}
                    <CtrlBtn
                        icon={<IcoCrown />}
                        label="호스트"
                        active={true}
                        activeColor="#facc15"
                    />
                    <CtrlBtn
                        icon={<IcoPeople />}
                        label={`참가자${guests.length > 0 ? '' : ''}`}
                        badge={guests.length}
                    />
                    <CtrlBtn icon={<IcoChat />} label="채팅" disabled />

                    <Divider />

                    {/* 설정 그룹 */}
                    <CtrlBtn icon={<IcoSettings />} label="설정" />
                    <CtrlBtn icon={<IcoMore />} label="더보기" />
                </div>

                {/* 오른쪽: 종료 */}
                <CtrlBtn icon={<IcoLeave />} label="종료" danger onClick={handleLeave} />
            </div>

            {/* PDF 업로드 모달 */}
            {isPdfUploadOpen && <PdfUploadModal />}

            {/* StudentDetailView 모달 (기존 유지) */}
            {selectedGuest && (
                <StudentDetailView
                    participant={selectedGuest}
                    strokes={allStrokes.get(selectedGuest.userId) ?? []}
                    activeStrokes={Array.from(activeStrokesMap.values()).filter(s => s.userId === selectedGuest.userId)}
                    annotationStrokes={annotationsMap.get(selectedGuest.userId) ?? []}
                    onClose={() => setSelectedGuest(null)}
                    onAnnotationStroke={handleAnnotationStroke}
                />
            )}
        </div>
    );
}
