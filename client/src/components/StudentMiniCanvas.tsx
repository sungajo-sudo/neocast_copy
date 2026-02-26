// Phase 3: 학생 미니 캔버스 카드
import React from 'react';
import DemoStrokeCanvas from './canvas/DemoStrokeCanvas';
import type { Stroke } from '../stores/demoStrokeStore';

interface StudentMiniCanvasProps {
    userId: string;
    nickname: string;
    strokes: Stroke[];
    activeStrokes: Stroke[];
    isAnnotating?: boolean;
    isWriting?: boolean;
    onClick: () => void;
}

// 카드 크기: A4 세로 비율 축소판 (1:√2)
const CARD_W = 350;
const CARD_H = Math.round(CARD_W * Math.sqrt(2) * 0.7); // A4 비율의 70% 높이

export default function StudentMiniCanvas({
    nickname,
    strokes,
    activeStrokes,
    isAnnotating = false,
    isWriting = false,
    onClick,
}: StudentMiniCanvasProps) {
    return (
        <div
            onClick={onClick}
            style={{
                width: CARD_W,
                height: CARD_H + 44,
                borderRadius: '16px',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.04)',
                border: isAnnotating
                    ? '2px solid #FF3B30'
                    : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                boxShadow: isAnnotating
                    ? '0 0 0 3px rgba(255,59,48,0.3)'
                    : '0 4px 20px rgba(0,0,0,0.3)',
                position: 'relative',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
        >
            {/* Canvas area */}
            <div style={{ width: CARD_W, height: CARD_H, background: '#fff', position: 'relative' }}>
                <DemoStrokeCanvas
                    strokes={strokes}
                    activeStrokes={activeStrokes}
                    width={CARD_W}
                    height={CARD_H}
                />
            </div>

            {/* Footer */}
            <div style={{
                height: 44,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: 8,
            }}>
                <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: '#fff',
                    fontWeight: 700,
                    flexShrink: 0,
                }}>
                    {nickname.slice(0, 1).toUpperCase()}
                </div>
                <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500, flex: 1 }}>
                    {nickname}
                </span>
                {isAnnotating && (
                    <span style={{
                        background: '#FF3B30',
                        color: '#fff',
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontWeight: 600,
                    }}>첨삭중</span>
                )}
                {!isAnnotating && isWriting && (
                    <span style={{
                        background: '#22c55e',
                        color: '#fff',
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontWeight: 600,
                    }}>✏️ 필기중</span>
                )}
            </div>
        </div>
    );
}
