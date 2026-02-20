import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { useSessionStore } from '../../stores/session-store';
import { useAuthStore } from '../../stores/auth-store';
import { useChatStore } from '../../stores/chat-store';
import { ncPaperHubClientService } from '../../services/nc-paperhub-client.service';
import { localPaperHubService } from '../../services/local-paperhub.service';
import { fileUploadService } from '../../services/file-upload.service';
import { chatService } from '../../services/chat-service';
import { generateNcodePdf, createPagesFromNcode, downloadPdf, generateNcodePdfFilename } from '../../services/ncode-pdf-generator.service';
import { PrintSettingsDialog, type PrintSettings } from '../dialogs/PrintSettingsDialog';
import type { LocalPaper } from '../../services/local-paperhub.service';
import type { ChatAttachment } from '../../stores/chat-store';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

/**
 * PDF 업로드 모달
 * - Drag & Drop 또는 파일 선택으로 PDF 업로드
 * - SOBP 할당 및 ncode-pdf compound 생성
 * - 채팅으로 공유 가능
 */
export const PdfUploadModal: React.FC = () => {
  const { t } = useTranslation();
  const isPdfUploadOpen = usePanelStore((state) => state.isPdfUploadOpen);
  const setPdfUploadOpen = usePanelStore((state) => state.setPdfUploadOpen);
  const session = useSessionStore((state) => state.session);
  const user = useAuthStore((state) => state.user);

  const isChatConnected = useChatStore((state) => state.isConnected);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedPaper, setUploadedPaper] = useState<LocalPaper | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // NCode PDF 생성 관련 상태
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ status: string; percent: number } | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const handleClose = useCallback(() => {
    setPdfUploadOpen(false);
    // 상태 초기화
    setUploadState('idle');
    setSelectedFile(null);
    setTitle('');
    setErrorMessage('');
    setUploadedPaper(null);
  }, [setPdfUploadOpen]);

  const handleFileSelect = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      setErrorMessage(t('pdf.invalidFileType', 'Please select a PDF file'));
      return;
    }
    setSelectedFile(file);
    setTitle(file.name.replace(/\.pdf$/i, ''));
    setErrorMessage('');
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !user) {
      return;
    }

    setUploadState('uploading');
    setErrorMessage('');

    try {
      const paper = await ncPaperHubClientService.registerAndSaveLocally(
        selectedFile,
        user.id,
        title || undefined
      );
      setUploadedPaper(paper);
      setUploadState('success');
    } catch (error) {
      console.error('Upload failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
      setUploadState('error');
    }
  }, [selectedFile, title, user]);

  const handleDownloadCompound = useCallback(async () => {
    if (!uploadedPaper || !user) {
      return;
    }

    const compound = await localPaperHubService.createCompound(
      user.id,
      user.name,
      uploadedPaper.paperGroupId
    );

    if (compound) {
      localPaperHubService.downloadCompound(compound);
    }
  }, [uploadedPaper, user]);

  // NCode PDF 생성 취소 핸들러
  const handleCancelGeneration = useCallback(() => {
    cancelRef.current = true;
    setIsCancelled(true);
  }, []);

  // NCode PDF 생성 및 다운로드
  const handleDownloadNcodePdf = useCallback(async (settings: PrintSettings) => {
    if (!uploadedPaper || !user) {
      return;
    }

    // 취소 플래그 초기화
    cancelRef.current = false;
    setIsCancelled(false);

    setIsPrintDialogOpen(false);
    setIsGeneratingPdf(true);
    setErrorMessage('');

    try {
      // Compound 생성
      const compound = await localPaperHubService.createCompound(
        user.id,
        user.name,
        uploadedPaper.paperGroupId
      );

      if (!compound) {
        throw new Error('Failed to create compound');
      }

      // 취소 확인
      if (cancelRef.current) {
        throw new Error('CANCELLED');
      }

      // PDF 데이터 디코딩
      const pdfBase64 = compound.pdfBase64;
      const binaryString = atob(pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pdfBuffer = bytes.buffer;

      // SOBP 정보
      const { section, owner, book, pageStart } = compound.sobp;
      const pageCount = compound.sobp.pageEnd - compound.sobp.pageStart + 1;

      // 페이지 정보 생성
      const pages = createPagesFromNcode(
        { section, owner, bookCode: book, pageStart },
        pageCount
      );

      // 취소 확인
      if (cancelRef.current) {
        throw new Error('CANCELLED');
      }

      // NCode PDF 생성
      const result = await generateNcodePdf({
        buffer: pdfBuffer,
        paperGroupId: `${section}_${owner}_${book}`,
        docName: compound.title,
        printInBlue: settings.printInBlue,
        ncodeGlyphScale: settings.ncodeGlyphScale,
        pages,
        onProgress: (status, percent, subStatus) => {
          // 취소된 경우 진행 상태 업데이트 스킵
          if (cancelRef.current) return;
          setPdfProgress({ status: subStatus ? `${status} (${subStatus})` : status, percent });
        },
      });

      // 취소된 경우 다운로드 스킵
      if (cancelRef.current) {
        throw new Error('CANCELLED');
      }

      // PDF 다운로드
      const filename = generateNcodePdfFilename(
        compound.title,
        { section, owner, book, pageStart },
        settings.printInBlue,
        settings.ncodeGlyphScale
      );
      downloadPdf(result.pdfBytes, filename);

      setPdfProgress(null);
    } catch (error) {
      // 취소된 경우 에러 메시지 표시하지 않음
      if (error instanceof Error && error.message === 'CANCELLED') {
        console.log('NCode PDF generation cancelled by user');
      } else {
        console.error('NCode PDF generation failed:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to generate NCode PDF');
      }
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
      setIsCancelled(false);
    }
  }, [uploadedPaper, user]);

  const handleShareToChat = useCallback(async () => {
    if (!uploadedPaper || !user) {
      return;
    }

    // 채팅 연결 확인
    if (!isChatConnected) {
      setErrorMessage(t('pdf.chatNotConnected', 'Chat is not connected. Please open the chat panel first.'));
      return;
    }

    setIsSharing(true);
    setErrorMessage('');

    try {
      // 1. NP2 Compound 생성
      const compound = await localPaperHubService.createCompound(
        user.id,
        user.name,
        uploadedPaper.paperGroupId
      );

      if (!compound) {
        throw new Error('Failed to create compound');
      }

      // 2. NP2 파일명 생성
      const np2Filename = localPaperHubService.generateNp2Filename(compound);

      // 3. Compound를 JSON Blob으로 변환
      const np2Json = JSON.stringify(compound, null, 2);
      const np2Blob = new Blob([np2Json], { type: 'application/json' });

      // 4. 파일 서버에 업로드
      const uploadResult = await fileUploadService.uploadBlob(
        np2Blob,
        np2Filename,
        'application/json',
        session?.id
      );

      // 5. 채팅으로 파일 메시지 전송
      const attachment: ChatAttachment = {
        id: uploadResult.fileId,
        filename: uploadResult.filename,
        mimeType: uploadResult.mimeType,
        size: uploadResult.size,
        url: uploadResult.url,
      };

      const sent = chatService.sendFileMessage([attachment], t('pdf.sharedDocument', '{{title}} shared', { title: uploadedPaper.title }));

      if (!sent) {
        throw new Error('Failed to send chat message');
      }

      // 6. 성공 시 모달 닫기
      handleClose();
    } catch (error) {
      console.error('Share to chat failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to share');
    } finally {
      setIsSharing(false);
    }
  }, [uploadedPaper, user, t, handleClose, isChatConnected, session]);

  const handleReset = useCallback(() => {
    setUploadState('idle');
    setSelectedFile(null);
    setTitle('');
    setErrorMessage('');
    setUploadedPaper(null);
  }, []);

  // ESC 키로 모달 닫기 또는 생성 취소
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPdfUploadOpen) {
        // NCode PDF 생성 중이면 취소
        if (isGeneratingPdf) {
          e.preventDefault();
          handleCancelGeneration();
        } else {
          handleClose();
        }
      }
    };

    if (isPdfUploadOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPdfUploadOpen, isGeneratingPdf, handleClose, handleCancelGeneration]);

  if (!isPdfUploadOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 - 외부 클릭으로 닫히지 않음 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in fade-in zoom-in duration-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            {t('pdf.uploadTitle', 'Upload PDF')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {uploadState === 'idle' && (
            <>
              {/* 드래그 앤 드롭 영역 */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50'
                    : selectedFile
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <svg className="w-12 h-12 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-600">
                      {t('pdf.dragDropHint', 'Drag and drop a PDF file here, or click to select')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t('pdf.maxSize', 'Maximum file size: 50MB')}
                    </p>
                  </div>
                )}
              </div>

              {/* 제목 입력 */}
              {selectedFile && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('pdf.documentTitle', 'Document Title')}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('pdf.titlePlaceholder', 'Enter document title')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* 에러 메시지 */}
              {errorMessage && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {errorMessage}
                </div>
              )}

              {/* 업로드 버튼 */}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!selectedFile}
                  className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {t('pdf.upload', 'Upload')}
                </button>
              </div>
            </>
          )}

          {uploadState === 'uploading' && (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600">{t('pdf.uploading', 'Uploading and assigning NCode...')}</p>
            </div>
          )}

          {uploadState === 'success' && uploadedPaper && (
            <div className="space-y-4">
              {/* 성공 아이콘 */}
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-lg font-semibold text-gray-800">
                  {t('pdf.uploadSuccess', 'Upload Successful!')}
                </h3>
              </div>

              {/* NCode 정보 */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('pdf.title', 'Title')}:</span>
                  <span className="font-medium text-gray-800">{uploadedPaper.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('pdf.pages', 'Pages')}:</span>
                  <span className="font-medium text-gray-800">{uploadedPaper.pageCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('pdf.ncode', 'NCode')}:</span>
                  <span className="font-mono font-medium text-gray-800">
                    {uploadedPaper.section}.{uploadedPaper.owner}.{uploadedPaper.book}.{uploadedPaper.pageStart}
                    {uploadedPaper.pageStart !== uploadedPaper.pageEnd && `-${uploadedPaper.pageEnd}`}
                  </span>
                </div>
              </div>

              {/* 액션 버튼들 */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleDownloadCompound}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('pdf.downloadCompound', 'Download .np2')}
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintDialogOpen(true)}
                  className="w-full py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {t('pdf.downloadNcodePdf', 'Download NCode PDF')}
                </button>

                {session && (
                  <button
                    type="button"
                    onClick={handleShareToChat}
                    disabled={isSharing || !isChatConnected}
                    className="w-full py-2 px-4 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSharing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        {t('pdf.sharing', 'Sharing...')}
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        {t('pdf.shareToChat', 'Share to Chat')}
                        {!isChatConnected && <span className="text-xs text-gray-400">({t('pdf.chatNotConnectedShort', 'Chat not connected')})</span>}
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-2 px-4 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('pdf.uploadAnother', 'Upload Another')}
                </button>
              </div>

              {/* 에러 메시지 */}
              {errorMessage && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {errorMessage}
                </div>
              )}

              {/* 닫기 버튼 */}
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          )}

          {uploadState === 'error' && (
            <div className="py-8 text-center">
              <svg className="w-16 h-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-lg font-semibold text-gray-800">
                {t('pdf.uploadFailed', 'Upload Failed')}
              </h3>
              <p className="mt-1 text-sm text-gray-600">{errorMessage}</p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  {t('common.tryAgain', 'Try Again')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* NCode PDF 생성 진행 오버레이 */}
        {isGeneratingPdf && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
            <div className="text-center p-6">
              {isCancelled ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">
                    {t('pdf.cancelling', 'Cancelling...')}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-800 font-medium mb-2">
                    {t('pdf.generatingNcodePdf', 'Generating NCode PDF...')}
                  </p>
                  {pdfProgress && (
                    <>
                      <p className="text-sm text-gray-500">{pdfProgress.status}</p>
                      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden w-48 mx-auto">
                        <div
                          className="h-full bg-green-500 transition-all duration-200"
                          style={{ width: `${pdfProgress.percent}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{pdfProgress.percent}%</p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelGeneration}
                    className="mt-4 px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    {t('pdf.pressEscToCancel', 'Press ESC to cancel')}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 인쇄 설정 다이얼로그 */}
      <PrintSettingsDialog
        isOpen={isPrintDialogOpen}
        onConfirm={handleDownloadNcodePdf}
        onCancel={() => setIsPrintDialogOpen(false)}
        confirmLabel={t('common.download', 'Download')}
      />
    </div>
  );
};

export default PdfUploadModal;
