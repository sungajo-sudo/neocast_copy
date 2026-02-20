/**
 * PDF Viewer Modal
 * 원본 PDF를 볼 수 있는 전체 화면 모달
 * - 왼쪽 썸네일 패널
 * - CMD/CTRL + 휠로 줌
 * - 줌 시 마우스 드래그로 패닝
 * - 최소 줌은 화면에 맞춤 (fit to screen)
 * - 최소 줌 상태에서 휠로 페이지 이동
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// PDF.js Worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  title: string;
}

interface ThumbnailData {
  pageNum: number;
  dataUrl: string;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfBlob,
  title,
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1); // fit-to-screen scale
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<ThumbnailData[]>([]);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);

  // 패닝 상태
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  // PDF 로드
  useEffect(() => {
    if (!isOpen || !pdfBlob) {
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      setThumbnails([]);
      setScale(1);
      setMinScale(1);
      return;
    }

    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          useWorkerFetch: false,
          isEvalSupported: false,
        });

        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error('[PdfViewerModal] Failed to load PDF:', err);
        setError(t('pdf.loadError', 'Failed to load PDF'));
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [isOpen, pdfBlob]);

  // 썸네일 생성
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return;

    const generateThumbnails = async () => {
      setThumbnailsLoading(true);
      const thumbs: ThumbnailData[] = [];

      for (let i = 1; i <= totalPages; i++) {
        try {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.2 }); // 썸네일용 작은 스케일

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;

          thumbs.push({
            pageNum: i,
            dataUrl: canvas.toDataURL('image/jpeg', 0.7),
          });
        } catch (err) {
          console.error(`[PdfViewerModal] Failed to generate thumbnail for page ${i}:`, err);
        }
      }

      setThumbnails(thumbs);
      setThumbnailsLoading(false);
    };

    generateThumbnails();
  }, [pdfDoc, totalPages]);

  // 페이지 렌더링
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;

        // 컨테이너 크기에 맞춰 fit-to-screen 스케일 계산
        const containerWidth = containerRef.current!.clientWidth - 48;
        const containerHeight = containerRef.current!.clientHeight - 48;

        const viewport = page.getViewport({ scale: 1 });
        const scaleX = containerWidth / viewport.width;
        const scaleY = containerHeight / viewport.height;
        const fitScale = Math.min(scaleX, scaleY);

        // minScale 설정 (fit-to-screen)
        setMinScale(fitScale);

        // 현재 스케일이 minScale보다 작으면 minScale로 설정
        const effectiveScale = Math.max(scale, fitScale);
        if (scale < fitScale) {
          setScale(fitScale);
        }

        const scaledViewport = page.getViewport({ scale: effectiveScale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({
          canvasContext: ctx,
          viewport: scaledViewport,
        }).promise;

        // 페이지 변경 시 스크롤 리셋
        if (containerRef.current) {
          containerRef.current.scrollLeft = 0;
          containerRef.current.scrollTop = 0;
        }
      } catch (err) {
        console.error('[PdfViewerModal] Failed to render page:', err);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  // 페이지 이동
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  // 줌 컨트롤
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.25, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const newScale = Math.max(s - 0.25, minScale);
      return newScale;
    });
  }, [minScale]);

  const resetZoom = useCallback(() => {
    setScale(minScale);
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
      containerRef.current.scrollTop = 0;
    }
  }, [minScale]);

  // 줌이 fit-to-screen 상태인지 확인
  const isAtMinZoom = scale <= minScale + 0.01;

  // 휠 이벤트 핸들러
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // CMD(Mac) 또는 CTRL(Windows) + 휠로 줌
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((s) => {
        const newScale = Math.max(minScale, Math.min(s + delta, 5));
        return newScale;
      });
    } else if (isAtMinZoom) {
      // 최소 줌 상태에서 휠로 페이지 이동
      if (e.deltaY > 0 && currentPage < totalPages) {
        goToPage(currentPage + 1);
      } else if (e.deltaY < 0 && currentPage > 1) {
        goToPage(currentPage - 1);
      }
    }
    // 줌된 상태에서는 기본 스크롤 동작 허용
  }, [minScale, isAtMinZoom, currentPage, totalPages, goToPage]);

  // 마우스 드래그로 패닝
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isAtMinZoom && e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      if (containerRef.current) {
        setScrollStart({
          x: containerRef.current.scrollLeft,
          y: containerRef.current.scrollTop,
        });
      }
      e.preventDefault();
    }
  }, [isAtMinZoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && containerRef.current) {
      const dx = panStart.x - e.clientX;
      const dy = panStart.y - e.clientY;
      containerRef.current.scrollLeft = scrollStart.x + dx;
      containerRef.current.scrollTop = scrollStart.y + dy;
    }
  }, [isPanning, panStart, scrollStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // 썸네일 클릭으로 페이지 이동
  const handleThumbnailClick = useCallback((pageNum: number) => {
    goToPage(pageNum);
  }, [goToPage]);

  // 현재 페이지 썸네일이 보이도록 스크롤
  useEffect(() => {
    if (thumbnailContainerRef.current) {
      const thumbnail = thumbnailContainerRef.current.querySelector(`[data-page="${currentPage}"]`);
      if (thumbnail) {
        thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentPage]);

  // 키보드 네비게이션
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          if (isAtMinZoom) {
            goToPage(currentPage - 1);
          }
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          if (isAtMinZoom) {
            goToPage(currentPage + 1);
          }
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          resetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPage, goToPage, zoomIn, zoomOut, resetZoom, onClose, isAtMinZoom]);

  // 마우스 업 이벤트를 window에서 감지
  useEffect(() => {
    if (isPanning) {
      const handleGlobalMouseUp = () => setIsPanning(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isPanning]);

  if (!isOpen) return null;

  // Portal을 사용하여 body 레벨에서 렌더링 (stacking context 문제 방지)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 컨테이너 */}
      <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col w-full h-full max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-medium text-gray-800 truncate max-w-md">{title}</span>
          </div>

          {/* 줌 컨트롤 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              disabled={isAtMinZoom}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('pdf.zoomOut', 'Zoom Out')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors min-w-[60px]"
            >
              {Math.round((scale / minScale) * 100)}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              title={t('pdf.zoomIn', 'Zoom In')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 메인 콘텐츠: 썸네일 + PDF 뷰어 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 썸네일 패널 */}
          <div
            ref={thumbnailContainerRef}
            className="w-[140px] flex-shrink-0 bg-gray-800 overflow-y-auto border-r border-gray-700"
          >
            {thumbnailsLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="animate-spin w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full mb-2" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {thumbnails.map((thumb) => (
                  <div
                    key={thumb.pageNum}
                    data-page={thumb.pageNum}
                    onClick={() => handleThumbnailClick(thumb.pageNum)}
                    className={`cursor-pointer rounded-lg overflow-hidden transition-all ${
                      currentPage === thumb.pageNum
                        ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-800'
                        : 'hover:ring-2 hover:ring-gray-500 hover:ring-offset-1 hover:ring-offset-gray-800'
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={thumb.dataUrl}
                        alt={`Page ${thumb.pageNum}`}
                        className="w-full h-auto bg-white"
                      />
                      <div className={`absolute bottom-0 left-0 right-0 text-center text-xs py-1 ${
                        currentPage === thumb.pageNum
                          ? 'bg-blue-500 text-white'
                          : 'bg-black/60 text-gray-300'
                      }`}>
                        {thumb.pageNum}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PDF 뷰어 */}
          <div
            ref={containerRef}
            className={`flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-6 ${
              !isAtMinZoom ? 'cursor-grab' : ''
            } ${isPanning ? 'cursor-grabbing' : ''}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center text-gray-500">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-3" />
                <span>{t('common.loading', 'Loading...')}</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center text-red-500">
                <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="shadow-lg bg-white select-none"
                style={{
                  maxWidth: isAtMinZoom ? '100%' : 'none',
                  maxHeight: isAtMinZoom ? '100%' : 'none',
                }}
                draggable={false}
              />
            )}
          </div>
        </div>

        {/* 페이지 네비게이션 */}
        {totalPages > 0 && (
          <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('pdf.firstPage', 'First Page')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('pdf.prevPage', 'Previous Page')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value, 10) || 1)}
                min={1}
                max={totalPages}
                className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-600">/ {totalPages}</span>
            </div>

            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('pdf.nextPage', 'Next Page')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('pdf.lastPage', 'Last Page')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default PdfViewerModal;
