import React from 'react';
import { usePanelStore } from '../../stores/panel-store';
import { usePageStore } from '../../stores/page-store';

export default function PagesButton() {
    const { activeLeftPanel, toggleLeftPanel } = usePanelStore();
    const pages = usePageStore(s => s.pages);
    const currentPageId = usePageStore(s => s.currentPageId);

    const isActive = activeLeftPanel === 'pages';
    const currentIndex = pages.findIndex(p => p.id === currentPageId);
    const label = pages.length > 0 ? `${currentIndex + 1} / ${pages.length}` : '—';

    return (
        <button
            onClick={() => toggleLeftPanel('pages')}
            title="페이지 목록"
            style={{
                position: 'fixed',
                left: isActive ? 216 : 16,   // 패널 열릴 때 오른쪽으로 이동
                bottom: 80,
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: isActive
                    ? 'rgba(99,102,241,0.92)'
                    : 'rgba(15,12,41,0.88)',
                border: isActive
                    ? '1px solid rgba(99,102,241,0.6)'
                    : '1px solid rgba(255,255,255,0.14)',
                borderRadius: 20,
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                backdropFilter: 'blur(14px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                transition: 'left 0.25s ease, background 0.15s',
                letterSpacing: '0.02em',
            }}
        >
            <span style={{ fontSize: '0.9rem' }}>📄</span>
            {label}
        </button>
    );
}
