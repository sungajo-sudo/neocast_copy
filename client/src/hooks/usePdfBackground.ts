import { useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePdfPageStore } from '../stores/pdfPageStore';
import { useSessionStore } from '../stores/sessionStore';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).href;

// A4 세로 기준 캔버스 너비 (GuestCanvas/HostCanvas와 동일)
const CANVAS_W = 700;

export function usePdfBackground() {
    const { sessionId, role } = useSessionStore();
    const { setImageUrl, setTotalPages, setCurrentPage, reset, currentPage } = usePdfPageStore();
    const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

    // PDF 페이지를 캔버스에 렌더링 → base64 이미지 저장
    const renderPage = useCallback(async (
        doc: pdfjsLib.PDFDocumentProxy,
        pageNum: number
    ) => {
        const page = await doc.getPage(pageNum);
        const naturalVp = page.getViewport({ scale: 1 });
        const scale = CANVAS_W / naturalVp.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        setImageUrl(canvas.toDataURL('image/jpeg', 0.88));
    }, [setImageUrl]);

    // 세션 시작 시 PDF 로드
    useEffect(() => {
        if (!sessionId) return;

        const loadPdf = async () => {
            const worksheetId = localStorage.getItem(`nc_session_worksheet_${sessionId}`);
            if (!worksheetId) { reset(); return; }

            const pdfBase64 = localStorage.getItem(`nc_ws_pdf_${worksheetId}`);
            if (!pdfBase64) { reset(); return; }

            try {
                // base64 → Uint8Array
                const raw = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
                const binary = atob(raw);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

                const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
                pdfDocRef.current = pdfDoc;
                setTotalPages(pdfDoc.numPages);
                await renderPage(pdfDoc, 1);
                setCurrentPage(1);
                // 호스트: 초기 페이지 번호 저장
                if (role === 'host') {
                    localStorage.setItem(`nc_session_page_${sessionId}`, '1');
                }
            } catch (e) {
                console.error('[usePdfBackground] PDF 로드 실패:', e);
                reset();
            }
        };

        loadPdf();
        return () => {
            reset();
            pdfDocRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    // 페이지 이동 (호스트만 제어)
    const goToPage = useCallback(async (pageNum: number) => {
        const doc = pdfDocRef.current;
        if (!doc) return;
        const clamped = Math.max(1, Math.min(doc.numPages, pageNum));
        await renderPage(doc, clamped);
        setCurrentPage(clamped);
        if (sessionId) {
            localStorage.setItem(`nc_session_page_${sessionId}`, String(clamped));
        }
    }, [sessionId, renderPage, setCurrentPage]);

    // 게스트: 호스트 페이지 변경 폴링
    useEffect(() => {
        if (role !== 'guest' || !sessionId) return;

        const poll = async () => {
            const doc = pdfDocRef.current;
            if (!doc) return;
            const pageStr = localStorage.getItem(`nc_session_page_${sessionId}`);
            if (!pageStr) return;
            const page = parseInt(pageStr, 10);
            if (!isNaN(page) && page !== usePdfPageStore.getState().currentPage) {
                await renderPage(doc, page);
                setCurrentPage(page);
            }
        };

        const interval = setInterval(poll, 500);
        return () => clearInterval(interval);
    }, [sessionId, role, renderPage, setCurrentPage]);

    return { goToPage, currentPage };
}
