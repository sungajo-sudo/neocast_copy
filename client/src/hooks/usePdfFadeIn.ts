/**
 * usePdfFadeIn.ts
 * 기능 A: 스마트펜 첫 stroke 감지 → PDF 배경 fade-in
 *
 * 역할:
 * 1. usePdfBackground()를 내부에서 호출해 PDF 로드
 * 2. watchFirstPenStroke → 첫 stroke 감지 시 opacity 0→1 애니메이션 (300ms)
 * 3. usePageStore.currentPageId 변경 시 해당 PDF 페이지로 교체
 * 4. Feature B: 호스트 페이지 추가/이동 → nc_session_pages_${sessionId} 저장
 *              게스트: 500ms 폴링으로 동기화
 */
import { useEffect, useRef } from 'react';
import { usePdfBackground } from './usePdfBackground';
import { usePageStore } from '../stores/page-store';
import { usePdfPageStore } from '../stores/pdfPageStore';
import { useSessionStore } from '../stores/sessionStore';
import { watchFirstPenStroke } from '../services/pen-event-bridge';

const FADE_DURATION_MS = 300;

export function usePdfFadeIn() {
    const { goToPage } = usePdfBackground(); // PDF 로드 + imageUrl 관리
    const setOpacity = usePdfPageStore(s => s.setOpacity);
    const { sessionId, userId, role } = useSessionStore();

    const pages = usePageStore(s => s.pages);
    const currentPageId = usePageStore(s => s.currentPageId);
    const { initializeFirstPage, setCurrentPage: setStorePage, addPage, reset: resetPages } = usePageStore();

    const fadeRafRef = useRef<number | null>(null);
    const fadeStartRef = useRef<number | null>(null);
    const cleanupBridgeRef = useRef<(() => void) | null>(null);

    // 세션 진입 시 첫 페이지 초기화
    useEffect(() => {
        if (!sessionId) return;
        initializeFirstPage();
        return () => {
            resetPages();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    // 첫 stroke 감지 → opacity 0→1 fade-in
    useEffect(() => {
        if (!sessionId || !userId) return;

        const startFade = () => {
            const start = performance.now();
            fadeStartRef.current = start;

            const animate = (now: number) => {
                const elapsed = now - start;
                const progress = Math.min(elapsed / FADE_DURATION_MS, 1);
                setOpacity(progress);
                if (progress < 1) {
                    fadeRafRef.current = requestAnimationFrame(animate);
                }
            };
            fadeRafRef.current = requestAnimationFrame(animate);
        };

        cleanupBridgeRef.current = watchFirstPenStroke(sessionId, userId, startFade);

        return () => {
            cleanupBridgeRef.current?.();
            if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
        };
    }, [sessionId, userId, setOpacity]);

    // currentPageId 변경 → 해당 PDF 페이지 렌더링 (0-based index → 1-based page num)
    useEffect(() => {
        if (!currentPageId || pages.length === 0) return;
        const idx = pages.findIndex(p => p.id === currentPageId);
        if (idx < 0) return;
        goToPage(idx + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPageId]);

    // 호스트: 페이지 상태 변경 시 localStorage 저장 (Feature B 동기화)
    useEffect(() => {
        if (role !== 'host' || !sessionId || pages.length === 0) return;
        const state = { pages: pages.map(p => ({ id: p.id, label: p.label, createdAt: p.createdAt })), currentPageId };
        localStorage.setItem(`nc_session_pages_${sessionId}`, JSON.stringify(state));
    }, [pages, currentPageId, sessionId, role]);

    // 게스트: nc_session_pages_${sessionId} 폴링 → 페이지 동기화 (Feature B)
    useEffect(() => {
        if (role !== 'guest' || !sessionId) return;

        const poll = () => {
            const raw = localStorage.getItem(`nc_session_pages_${sessionId}`);
            if (!raw) return;
            try {
                const { pages: hostPages, currentPageId: hostCurrentPageId } = JSON.parse(raw) as {
                    pages: { id: string; label: string; createdAt: number }[];
                    currentPageId: string;
                };
                const store = usePageStore.getState();

                // 페이지 목록 동기화 (새 페이지 추가 감지)
                if (hostPages.length !== store.pages.length) {
                    const diff = hostPages.length - store.pages.length;
                    if (diff > 0) {
                        for (let i = 0; i < diff; i++) addPage();
                    }
                }

                // 현재 페이지 동기화
                if (hostCurrentPageId && hostCurrentPageId !== store.currentPageId) {
                    // 호스트 currentPageId에 매핑되는 인덱스로 게스트 페이지 이동
                    const hostIdx = hostPages.findIndex(p => p.id === hostCurrentPageId);
                    const guestPages = usePageStore.getState().pages;
                    if (hostIdx >= 0 && hostIdx < guestPages.length) {
                        setStorePage(guestPages[hostIdx].id);
                    }
                }
            } catch {
                // JSON 파싱 에러 무시
            }
        };

        const interval = setInterval(poll, 500);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, role]);
}
