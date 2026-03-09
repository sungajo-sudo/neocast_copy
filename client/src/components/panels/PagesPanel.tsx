/**
 * PagesPanel — 페이지 목록 사이드 패널
 *
 * - activeLeftPanel === 'pages' 일 때 슬라이드인으로 표시
 * - 페이지 추가/이동/삭제
 * - 호스트: nc_session_pages_${sessionId} 저장 (usePdfFadeIn에서 처리)
 * - 게스트: 읽기 전용 (usePdfFadeIn 폴링에서 동기화)
 */
import React from 'react';
import { usePanelStore } from '../../stores/panel-store';
import { usePageStore } from '../../stores/page-store';
import { useSessionStore } from '../../stores/sessionStore';

export default function PagesPanel() {
    const { activeLeftPanel, toggleLeftPanel } = usePanelStore();
    const { pages, currentPageId, addPage, setCurrentPage, deletePage } = usePageStore();
    const role = useSessionStore(s => s.role);

    const isOpen = activeLeftPanel === 'pages';
    const isHost = role === 'host';

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: 200,
                height: '100vh',
                zIndex: 150,
                background: 'rgba(10, 8, 30, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
                transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* 헤더 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 12px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
            }}>
                <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.03em' }}>
                    페이지 목록
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                    {/* 페이지 추가 (호스트만) */}
                    {isHost && (
                        <button
                            onClick={() => addPage()}
                            title="페이지 추가"
                            style={btnStyle('#6366f1')}
                        >
                            +
                        </button>
                    )}
                    {/* 패널 닫기 */}
                    <button
                        onClick={() => toggleLeftPanel('pages')}
                        title="닫기"
                        style={btnStyle('rgba(255,255,255,0.15)')}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* 페이지 목록 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {pages.map((page, idx) => {
                    const isActive = page.id === currentPageId;
                    return (
                        <div
                            key={page.id}
                            onClick={() => setCurrentPage(page.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '9px 12px',
                                cursor: 'pointer',
                                background: isActive
                                    ? 'rgba(99,102,241,0.25)'
                                    : 'transparent',
                                borderLeft: isActive
                                    ? '3px solid #6366f1'
                                    : '3px solid transparent',
                                transition: 'background 0.15s',
                            }}
                        >
                            <span style={{
                                color: isActive ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
                                fontSize: '0.82rem',
                                fontWeight: isActive ? 700 : 400,
                                userSelect: 'none',
                            }}>
                                {isActive ? '▶ ' : '　'}{idx + 1}페이지
                            </span>

                            {/* 삭제 버튼 (호스트만, 페이지 1개일 때 비활성) */}
                            {isHost && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deletePage(page.id);
                                    }}
                                    disabled={pages.length <= 1}
                                    title="페이지 삭제"
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: pages.length <= 1
                                            ? 'rgba(255,255,255,0.15)'
                                            : 'rgba(255,100,100,0.7)',
                                        cursor: pages.length <= 1 ? 'default' : 'pointer',
                                        fontSize: '0.75rem',
                                        padding: '2px 4px',
                                        borderRadius: 4,
                                        lineHeight: 1,
                                        flexShrink: 0,
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    );
                })}

                {pages.length === 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textAlign: 'center', padding: 24 }}>
                        페이지 없음
                    </p>
                )}
            </div>

            {/* 하단 정보 */}
            <div style={{
                padding: '10px 12px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)',
                fontSize: '0.72rem',
                flexShrink: 0,
            }}>
                {pages.length}개 페이지
                {!isHost && <span style={{ marginLeft: 8, color: 'rgba(99,102,241,0.6)' }}>동기화 중</span>}
            </div>
        </div>
    );
}

function btnStyle(bg: string): React.CSSProperties {
    return {
        background: bg,
        border: 'none',
        color: '#fff',
        borderRadius: 6,
        width: 22,
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 700,
        lineHeight: 1,
        padding: 0,
        flexShrink: 0,
    };
}
