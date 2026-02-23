// Phase 3 + 4: 학생 상세 보기 모달 (호스트 전용)
// 첨삭 모드 ON 시 AnnotationLayer 오버레이
import React, { useState, useCallback } from 'react';
import DemoStrokeCanvas from './canvas/DemoStrokeCanvas';
import AnnotationLayer from './canvas/AnnotationLayer';
import type { Stroke } from '../stores/demoStrokeStore';

interface AnnotationStroke {
    color: string;
    lineWidth: number;
    points: { x: number; y: number }[];
}

interface Participant {
    userId: string;
    nickname: string;
}

interface StudentDetailViewProps {
    participant: Participant;
    strokes: Stroke[];
    activeStrokes: Stroke[];
    annotationStrokes: AnnotationStroke[];
    onClose: () => void;
    onAnnotationStroke: (guestId: string, pageId: string, points: { x: number; y: number }[]) => void;
}

const DETAIL_W = Math.min(window.innerWidth - 80, 900);
const DETAIL_H = Math.round(DETAIL_W * 0.65);
const PAGE_ID = 'page-1';

export default function StudentDetailView({
    participant,
    strokes,
    activeStrokes,
    annotationStrokes,
    onClose,
    onAnnotationStroke,
}: StudentDetailViewProps) {
    const [annotationMode, setAnnotationMode] = useState(false);

    const handleAnnotationStroke = useCallback((guestId: string, pageId: string, points: { x: number; y: number }[]) => {
        onAnnotationStroke(guestId, pageId, points);
    }, [onAnnotationStroke]);

    return (
        <div style={overlay} onClick={onClose}>
            <div style={modal} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={avatar}>{participant.nickname.slice(0, 1).toUpperCase()}</div>
                        <div>
                            <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>{participant.nickname}</div>
                            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>학생 캔버스 확대 보기</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            style={{
                                ...btnBase,
                                background: annotationMode
                                    ? 'linear-gradient(135deg, #FF3B30, #FF6B6B)'
                                    : 'rgba(255,255,255,0.1)',
                                boxShadow: annotationMode ? '0 0 12px rgba(255,59,48,0.5)' : 'none',
                            }}
                            onClick={() => setAnnotationMode(m => !m)}
                        >
                            {annotationMode ? '✏️ 첨삭 중' : '✏️ 첨삭 모드'}
                        </button>
                        <button style={{ ...btnBase, background: 'rgba(255,255,255,0.1)' }} onClick={onClose}>✕ 닫기</button>
                    </div>
                </div>

                {/* Canvas area */}
                <div style={{ position: 'relative', width: DETAIL_W, height: DETAIL_H, background: '#fff', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
                    <DemoStrokeCanvas
                        strokes={strokes}
                        activeStrokes={activeStrokes}
                        annotationStrokes={annotationStrokes}
                        width={DETAIL_W}
                        height={DETAIL_H}
                    />
                    {annotationMode && (
                        <AnnotationLayer
                            width={DETAIL_W}
                            height={DETAIL_H}
                            guestId={participant.userId}
                            pageId={PAGE_ID}
                            onStroke={handleAnnotationStroke}
                        />
                    )}
                    {annotationMode && (
                        <div style={annotationHint}>
                            🖌 마우스를 드래그해 첨삭하세요 · 빨간 획이 학생에게 실시간 전달됩니다
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
};
const modal: React.CSSProperties = {
    width: DETAIL_W,
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
};
const header: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: 'rgba(15,12,41,0.95)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
};
const avatar: React.CSSProperties = {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: '0.9rem',
};
const btnBase: React.CSSProperties = {
    border: 'none', borderRadius: '10px',
    color: '#fff', padding: '8px 14px',
    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    transition: 'all 0.2s',
};
const annotationHint: React.CSSProperties = {
    position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(255,59,48,0.9)',
    color: '#fff', padding: '6px 16px', borderRadius: '20px',
    fontSize: '0.8rem', fontWeight: 500, pointerEvents: 'none',
    whiteSpace: 'nowrap',
};
