// Phase 3: MonitoringView — 호스트 그리드 뷰
// participant_join/leave 이벤트로 학생 카드 추가/제거
// stroke 이벤트로 실시간 업데이트
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useDemoStrokeStore } from '../stores/demoStrokeStore';
import { getStrokeSocket, getControlSocket } from '../services/socketService';
import StudentMiniCanvas from './StudentMiniCanvas';
import StudentDetailView from './StudentDetailView';
import type { Stroke } from '../stores/demoStrokeStore';

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

// annotations per guest: guestId → AnnotationStroke[]
const annotationsMap = new Map<string, AnnotationStroke[]>();

export default function MonitoringView() {
    const { sessionId, userId, nickname, code, socketUrl } = useSessionStore();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedGuest, setSelectedGuest] = useState<Participant | null>(null);
    const [annotatingGuestId, setAnnotatingGuestId] = useState<string | null>(null);
    const [, forceUpdate] = useState(0);

    const addStroke = useDemoStrokeStore(s => s.addStroke);
    const updateActiveStroke = useDemoStrokeStore(s => s.updateActiveStroke);
    const finalizeStroke = useDemoStrokeStore(s => s.finalizeStroke);
    const getStrokes = useDemoStrokeStore(s => s.getStrokes);
    const activeStrokesMap = useDemoStrokeStore(s => s.activeStrokes);

    const controlSocketRef = useRef<ReturnType<typeof getControlSocket> | null>(null);

    useEffect(() => {
        if (!sessionId || !userId) return;

        // Connect sockets
        const strokeSock = getStrokeSocket(sessionId, userId);
        const controlSock = getControlSocket(sessionId, userId);
        controlSocketRef.current = controlSock;

        // ── Control events ──────────────────────────
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

        // ── Stroke events (binary) ──────────────────
        strokeSock.on('stroke', (data: ArrayBuffer | Buffer) => {
            try {
                // Wrapped format: 32 bytes senderId + rest is binary stroke data
                const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
                if (buf.length < 33) return;

                // Extract senderId from first 32 bytes
                const senderIdBytes = buf.slice(0, 32);
                const senderId = new TextDecoder().decode(senderIdBytes).replace(/\0/g, '');
                const strokeBuf = buf.slice(32);

                // Parse stroke data from JSON (demo server sends simple JSON-based strokes for demo mode)
                // Fallback: treat as raw
                try {
                    const json = JSON.parse(new TextDecoder().decode(strokeBuf));
                    if (json && json.type === 'stroke_begin') {
                        updateActiveStroke(json.strokeId, {
                            id: json.strokeId,
                            userId: senderId,
                            color: json.color ?? '#1a1a1a',
                            lineWidth: json.lineWidth ?? 2,
                            points: [],
                            done: false,
                        });
                    } else if (json && json.type === 'stroke_point') {
                        const existing = activeStrokesMap.get(json.strokeId);
                        if (existing) {
                            updateActiveStroke(json.strokeId, {
                                ...existing,
                                points: [...existing.points, { x: json.x, y: json.y, pressure: json.pressure ?? 0.5 }],
                            });
                        }
                    } else if (json && json.type === 'stroke_end') {
                        finalizeStroke(json.strokeId);
                    } else if (json && json.type === 'stroke_complete') {
                        // Complete stroke as one packet
                        const stroke: Stroke = {
                            id: json.strokeId,
                            userId: senderId,
                            color: json.color ?? '#1a1a1a',
                            lineWidth: json.lineWidth ?? 2,
                            points: json.points ?? [],
                            done: true,
                        };
                        addStroke(senderId, stroke);
                    }
                } catch {
                    // Not JSON, skip (could be pako-compressed from actual pen)
                }
            } catch (err) {
                console.warn('stroke parse error', err);
            }
        });

        return () => {
            strokeSock.off('stroke');
            controlSock.off('control');
        };
    }, [sessionId, userId, addStroke, updateActiveStroke, finalizeStroke, activeStrokesMap]);

    const handleAnnotationStroke = useCallback((guestId: string, _pageId: string, points: { x: number; y: number }[]) => {
        setAnnotatingGuestId(guestId);

        // Add to local annotation store
        const arr = annotationsMap.get(guestId) ?? [];
        arr.push({ color: '#FF3B30', lineWidth: 3, points });
        annotationsMap.set(guestId, arr);
        forceUpdate(n => n + 1);

        // Emit to server
        controlSocketRef.current?.emit('annotation:stroke', {
            guestId,
            pageId: 'page-1',
            points,
        });

        // Clear annotation badge after 3 seconds
        setTimeout(() => setAnnotatingGuestId(null), 3000);
    }, []);

    const guests = participants.filter(p => p.role === 'guest');

    return (
        <div style={container}>
            {/* Top bar */}
            <div style={topBar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.3rem' }}>✏️</span>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>NeoCast</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginLeft: 4 }}>Monitoring Mode</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={codeBadge}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>세션 코드</span>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.15rem' }}>{code}</span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                        👩‍🏫 {nickname} · 학생 {guests.length}명
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div style={grid}>
                {guests.length === 0 ? (
                    <div style={emptyState}>
                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🧑‍🎓</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem' }}>
                            학생이 세션에 참가하면 여기에 표시됩니다
                        </div>
                        <div style={{
                            marginTop: 12,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12,
                            padding: '10px 20px',
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '0.85rem',
                        }}>
                            입장 코드: <strong style={{ color: '#6366f1', letterSpacing: '0.1rem' }}>{code}</strong>
                        </div>
                    </div>
                ) : (
                    guests.map(p => {
                        const strokes = getStrokes(p.userId);
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
                    })
                )}
            </div>

            {/* StudentDetailView modal */}
            {selectedGuest && (
                <StudentDetailView
                    participant={selectedGuest}
                    strokes={getStrokes(selectedGuest.userId)}
                    activeStrokes={Array.from(activeStrokesMap.values()).filter(s => s.userId === selectedGuest.userId)}
                    annotationStrokes={annotationsMap.get(selectedGuest.userId) ?? []}
                    onClose={() => setSelectedGuest(null)}
                    onAnnotationStroke={handleAnnotationStroke}
                />
            )}
        </div>
    );
}

const container: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0f0c29 0%, #1a1540 50%, #0f2027 100%)',
    fontFamily: "'Inter', sans-serif",
};
const topBar: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: 60,
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(10px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
};
const codeBadge: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 10,
    padding: '4px 14px',
};
const grid: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
    padding: '28px 24px',
    alignItems: 'flex-start',
};
const emptyState: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 0',
};
