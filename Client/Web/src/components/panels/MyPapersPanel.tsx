/**
 * My Papers Panel
 * 사용자가 생성한 PDF/NP2 목록을 표시
 * 좁은 폭에서도 잘 보이도록 레이아웃 최적화
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import { usePanelStore } from '../../stores/panel-store';
import { useAlert } from '../../contexts/AlertContext';
import {
  ncPaperHubClientService,
  type PaperInfo,
} from '../../services/nc-paperhub-client.service';
import { fileUploadService } from '../../services/file-upload.service';
import { chatService } from '../../services/chat-service';
import { PrintSettingsDialog, type PrintSettings } from '../dialogs/PrintSettingsDialog';
import { generateNcodePdf, downloadPdf, generateNcodePdfFilename } from '../../services/ncode-pdf-generator.service';
import { PdfViewerModal } from '../layout/PdfViewerModal';

export function MyPapersPanel() {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlert();
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const session = useSessionStore((state) => state.session);
  const setActiveLeftPanel = usePanelStore((state) => state.setActiveLeftPanel);
  const leftPanelWidth = usePanelStore((state) => state.leftPanelWidth);
  const showToast = usePanelStore((state) => state.showToast);

  const [papers, setPapers] = useState<PaperInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 인쇄 다이얼로그 상태
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<PaperInfo | null>(null);

  // PDF 뷰어 상태
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [viewerPdfBlob, setViewerPdfBlob] = useState<Blob | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');

  // 처리 중 상태
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 패널 폭이 좁은지 확인 (아이콘만 표시할지)
  const isNarrow = leftPanelWidth < 320;

  // Paper 목록 로드 (서버에서 가져옴)
  const loadPapers = useCallback(async () => {
    if (!currentUserId) {
      setPapers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      // 서버에서 사용자의 모든 페이퍼 조회
      const allPapers = await ncPaperHubClientService.getPapers();
      // 최신순 정렬 (createdAt은 ISO string)
      allPapers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPapers(allPapers);
    } catch (err) {
      console.error('[MyPapersPanel] Failed to load papers:', err);
      setError(t('myPapers.loadError', 'Failed to load papers'));
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, t]);

  // 컴포넌트 마운트 시 로드
  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // 원본 PDF 보기 (서버에서 다운로드)
  const handleViewOriginal = useCallback(async (paper: PaperInfo) => {
    try {
      setProcessingId(paper.paperGroupId);
      const pdfBlob = await ncPaperHubClientService.downloadPdf(paper.paperGroupId);
      setViewerPdfBlob(pdfBlob);
      setViewerTitle(paper.title);
      setIsPdfViewerOpen(true);
    } catch (err) {
      console.error('[MyPapersPanel] Failed to download PDF:', err);
      showAlert({ message: t('myPapers.downloadError'), type: 'error' });
    } finally {
      setProcessingId(null);
    }
  }, [t]);

  // 삭제 핸들러 (서버에서 삭제)
  const handleDelete = useCallback(
    async (paper: PaperInfo) => {
      if (!(await showConfirm(t('myPapers.confirmDelete', 'Are you sure you want to delete this paper?')))) {
        return;
      }

      try {
        setProcessingId(paper.paperGroupId);
        await ncPaperHubClientService.deletePaper(paper.paperGroupId);
        setPapers((prev) => prev.filter((p) => p.paperGroupId !== paper.paperGroupId));
        showToast(t('myPapers.deleteSuccess', 'Paper deleted'));
      } catch (err) {
        console.error('[MyPapersPanel] Failed to delete paper:', err);
        showAlert({ message: t('myPapers.deleteError'), type: 'error' });
      } finally {
        setProcessingId(null);
      }
    },
    [t, showToast, showAlert, showConfirm]
  );

  // 채팅으로 공유 핸들러 (서버에서 compound 다운로드)
  const handleShare = useCallback(
    async (paper: PaperInfo) => {
      try {
        setProcessingId(paper.paperGroupId);

        // 서버에서 Compound 다운로드
        const compound = await ncPaperHubClientService.downloadCompound(paper.paperGroupId);

        // NP2 파일명 생성
        const safeName = paper.title.replace(/[^a-zA-Z0-9가-힣\s_-]/g, '').trim();
        const np2Filename = `${safeName}-${paper.section}_${paper.owner}_${paper.book}_${paper.pageStart}-${paper.pageEnd}.np2`;
        const np2Blob = new Blob([JSON.stringify(compound)], { type: 'application/json' });

        const uploadResult = await fileUploadService.uploadBlob(
          np2Blob,
          np2Filename,
          'application/json',
          session?.id
        );

        // 채팅으로 전송
        const attachment = {
          id: uploadResult.fileId,
          filename: uploadResult.filename,
          mimeType: uploadResult.mimeType,
          size: uploadResult.size,
          url: uploadResult.url,
        };

        chatService.sendFileMessage(
          [attachment],
          t('pdf.sharedDocument', '{{title}} shared', { title: paper.title })
        );

        showToast(t('myPapers.shareSuccess', 'Shared to chat'));
      } catch (err) {
        console.error('[MyPapersPanel] Failed to share paper:', err);
        showAlert({ message: t('myPapers.shareError'), type: 'error' });
      } finally {
        setProcessingId(null);
      }
    },
    [session?.id, t, showToast, showAlert]
  );

  // 인쇄물 다운로드 핸들러
  const handlePrintClick = useCallback((paper: PaperInfo) => {
    setSelectedPaper(paper);
    setIsPrintDialogOpen(true);
  }, []);

  // 인쇄 확인 핸들러 (서버에서 compound 다운로드)
  const handlePrintConfirm = useCallback(
    async (settings: PrintSettings) => {
      if (!selectedPaper) return;

      setIsPrintDialogOpen(false);

      try {
        setProcessingId(selectedPaper.paperGroupId);

        // 서버에서 Compound 다운로드
        const compound = await ncPaperHubClientService.downloadCompound(selectedPaper.paperGroupId);

        // PDF 디코딩
        const binaryString = atob(compound.pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // 페이지 정보 생성 (pageIndex 포함)
        const pages = [];
        for (let i = compound.sobp.pageStart; i <= compound.sobp.pageEnd; i++) {
          pages.push({
            section: compound.sobp.section,
            owner: compound.sobp.owner,
            book: compound.sobp.book,
            page: i,
            pageIndex: i - compound.sobp.pageStart,
          });
        }

        // NCode PDF 생성
        const result = await generateNcodePdf({
          buffer: bytes.buffer,
          paperGroupId: compound.paperGroupId,
          docName: compound.title,
          pages,
          printInBlue: settings.printInBlue,
          ncodeGlyphScale: settings.ncodeGlyphScale,
        });

        // 다운로드
        const filename = generateNcodePdfFilename(
          compound.title,
          {
            section: compound.sobp.section,
            owner: compound.sobp.owner,
            book: compound.sobp.book,
            pageStart: compound.sobp.pageStart,
          },
          settings.printInBlue,
          settings.ncodeGlyphScale
        );
        downloadPdf(result.pdfBytes, filename);
      } catch (err) {
        console.error('[MyPapersPanel] Failed to print:', err);
        showAlert({ message: t('myPapers.printError'), type: 'error' });
      } finally {
        setProcessingId(null);
        setSelectedPaper(null);
      }
    },
    [selectedPaper, t, showAlert]
  );

  // 날짜 포맷 (시간 포함) - ISO string 또는 timestamp 지원
  const formatDateTime = (dateValue: string | number): string => {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="w-4 h-4 text-gray-600 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
          <span className="font-medium text-gray-800 text-sm truncate">
            {t('controlBar.myMaterials', 'My Materials')}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">({papers.length})</span>
        </div>
        <button
          type="button"
          onClick={() => setActiveLeftPanel(null)}
          className="p-1 text-gray-500 hover:text-gray-700 rounded flex-shrink-0"
          title={t('common.close', 'Close')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              type="button"
              onClick={loadPapers}
              className="mt-2 text-sm text-blue-500 hover:text-blue-700"
            >
              {t('common.retry', 'Retry')}
            </button>
          </div>
        ) : papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center text-gray-500">
            <svg
              className="w-10 h-10 mb-2 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            <p className="text-sm">{t('myPapers.empty', 'No papers yet')}</p>
            <p className="text-xs text-gray-400 mt-1">
              {t('myPapers.emptyHint', 'Upload a PDF to create your first paper')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {papers.map((paper) => (
              <div
                key={paper.paperGroupId}
                className={`bg-gray-50 rounded-lg p-2.5 border border-gray-200/50 ${
                  processingId === paper.paperGroupId ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {/* Line 1: 파일명 */}
                <h4 className="font-medium text-gray-800 text-sm truncate mb-1" title={paper.title}>
                  {paper.title}
                </h4>

                {/* Line 2: 페이지 수, 생성일시 */}
                <div className="text-xs text-gray-500 mb-0.5">
                  <span className="font-medium">{paper.pageCount}P</span>
                  <span className="mx-1.5 text-gray-300">|</span>
                  <span>{formatDateTime(paper.createdAt)}</span>
                </div>

                {/* Line 3: SOBP */}
                <div className="text-xs text-gray-400 font-mono mb-2">
                  SOBP: {paper.section}.{paper.owner}.{paper.book}.{paper.pageStart}
                  {paper.pageEnd !== paper.pageStart && `-${paper.pageEnd}`}
                </div>

                {/* Line 4: 액션 버튼 */}
                <div className="flex items-center gap-1 pt-1.5 border-t border-gray-200/50">
                  {/* 원본 보기 */}
                  <button
                    type="button"
                    onClick={() => handleViewOriginal(paper)}
                    disabled={processingId === paper.paperGroupId}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    title={t('myPapers.viewOriginal', 'View Original')}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {!isNarrow && <span className="truncate">{t('myPapers.view', 'View')}</span>}
                  </button>

                  {/* 인쇄물 다운로드 */}
                  <button
                    type="button"
                    onClick={() => handlePrintClick(paper)}
                    disabled={processingId === paper.paperGroupId}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                    title={t('myPapers.downloadPrint', 'Download Print')}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    {!isNarrow && <span className="truncate">{t('myPapers.print', 'Print')}</span>}
                  </button>

                  {/* 공유 */}
                  <button
                    type="button"
                    onClick={() => handleShare(paper)}
                    disabled={processingId === paper.paperGroupId}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 text-xs text-green-600 bg-green-50 hover:bg-green-100 rounded transition-colors"
                    title={t('myPapers.share', 'Share')}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    {!isNarrow && <span className="truncate">{t('myPapers.share', 'Share')}</span>}
                  </button>

                  {/* 삭제 */}
                  <button
                    type="button"
                    onClick={() => handleDelete(paper)}
                    disabled={processingId === paper.paperGroupId}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                    title={t('myPapers.delete', 'Delete')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* 로딩 인디케이터 */}
                {processingId === paper.paperGroupId && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 인쇄 설정 다이얼로그 */}
      <PrintSettingsDialog
        isOpen={isPrintDialogOpen}
        onConfirm={handlePrintConfirm}
        onCancel={() => {
          setIsPrintDialogOpen(false);
          setSelectedPaper(null);
        }}
      />

      {/* PDF 뷰어 모달 */}
      <PdfViewerModal
        isOpen={isPdfViewerOpen}
        onClose={() => {
          setIsPdfViewerOpen(false);
          setViewerPdfBlob(null);
          setViewerTitle('');
        }}
        pdfBlob={viewerPdfBlob}
        title={viewerTitle}
      />
    </div>
  );
}

export default MyPapersPanel;
