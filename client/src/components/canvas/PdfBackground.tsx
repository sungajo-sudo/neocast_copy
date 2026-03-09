/**
 * PdfBackground — App.tsx /session 라우트에 주입되는 PDF 관리 컴포넌트
 *
 * 역할:
 * 1. usePdfFadeIn() 훅 마운트 → PDF 로드 + fade-in 애니메이션 + 페이지 동기화
 * 2. PDF 로드 시 현재/전체 페이지 인디케이터 표시 (읽기 전용)
 *    ※ 페이지 이동은 Feature B PagesPanel이 담당
 */
import React from 'react';
import { usePdfFadeIn } from '../../hooks/usePdfFadeIn';
import { usePdfPageStore } from '../../stores/pdfPageStore';

export default function PdfBackground() {
    // 훅 마운트 — PDF 로드 + fade-in + 페이지 연동 + 게스트 sync
    usePdfFadeIn();

    const imageUrl = usePdfPageStore(s => s.imageUrl);
    const totalPages = usePdfPageStore(s => s.totalPages);
    const currentPage = usePdfPageStore(s => s.currentPage);

    // PDF가 없는 세션이면 아무것도 렌더링하지 않음
    if (!imageUrl || totalPages === 0) return null;

    return (
        // 하단에 고정된 페이지 인디케이터 (읽기 전용)
        <div style={{
            position: 'fixed',
            bottom: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(15, 12, 41, 0.88)',
            backdropFilter: 'blur(14px)',
            borderRadius: 24,
            padding: '6px 16px',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff',
            userSelect: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
        }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.6, marginRight: 4 }}>📄</span>
            <span style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                minWidth: 54,
                textAlign: 'center',
                letterSpacing: '0.04em',
                color: 'rgba(255,255,255,0.9)',
            }}>
                {currentPage} / {totalPages}
            </span>
        </div>
    );
}
