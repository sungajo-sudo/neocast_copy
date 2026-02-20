import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelHeader } from './PanelHeader';
import { usePanelStore } from '../../stores/panel-store';
import { useSessionStore } from '../../stores/session-store';
import { useChatStore, type ChatMessage, type ChatAttachment } from '../../stores/chat-store';
import { useConnectionStore } from '../../stores/connection-store';
import { chatService } from '../../services/chat-service';
import { fileUploadService, type UploadProgress } from '../../services/file-upload.service';
import { PrintSettingsDialog, type PrintSettings } from '../dialogs/PrintSettingsDialog';
import { generateNcodePdf, createPagesFromNcode, downloadPdf, generateNcodePdfFilename } from '../../services/ncode-pdf-generator.service';
import type { NcodePdfCompound } from '../../services/local-paperhub.service';

/**
 * 채팅 패널 컴포넌트
 * Socket.IO 기반 실시간 채팅
 */
export const ChatPanel: React.FC = () => {
  const { t } = useTranslation();
  const setActiveRightPanel = usePanelStore((state) => state.setActiveRightPanel);
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const getUserColor = useSessionStore((state) => state.getUserColor);

  // 채팅 스토어
  const messages = useChatStore((state) => state.messages);
  const typingUsers = useChatStore((state) => state.typingUsers);
  const isConnected = useChatStore((state) => state.isConnected);

  // 소켓 연결
  const chatSocket = useConnectionStore((state) => state.chatSocket);

  // 로컬 상태
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // NP2 인쇄 관련 상태
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedNp2, setSelectedNp2] = useState<NcodePdfCompound | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState<{ status: string; percent: number } | null>(null);

  // 채팅 서비스 연결
  useEffect(() => {
    if (chatSocket && !isConnected) {
      chatService.connect(chatSocket);
    }

    return () => {
      // 컴포넌트 언마운트 시 연결 해제하지 않음 (세션 유지)
      // chatService.disconnect();
    };
  }, [chatSocket, isConnected]);

  // 메시지 스크롤 to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 파일 업로드 핸들러
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploadError(null);

    for (const file of fileArray) {
      // 유효성 검사
      const validation = fileUploadService.validateFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid file');
        continue;
      }

      try {
        const result = await fileUploadService.uploadFile(file, undefined, (progress) => {
          setUploadProgress(progress);
        });

        // 업로드 성공 시 채팅으로 전송
        const attachment: ChatAttachment = {
          id: result.fileId,
          filename: result.filename,
          mimeType: result.mimeType,
          size: result.size,
          url: result.url,
        };

        chatService.sendFileMessage([attachment]);
        setUploadProgress(null);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Upload failed');
        setUploadProgress(null);
      }
    }
  }, []);

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 드롭 존 밖으로 나갈 때만 상태 변경
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  // NP2 파일 클릭 핸들러
  const handleNp2Click = useCallback(async (attachment: ChatAttachment) => {
    try {
      // NP2 파일 다운로드
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error('Failed to download NP2 file');
      }

      const np2Json = await response.text();
      const compound = JSON.parse(np2Json) as NcodePdfCompound;

      // 인쇄 다이얼로그 표시
      setSelectedNp2(compound);
      setIsPrintDialogOpen(true);
    } catch (error) {
      console.error('Failed to load NP2 file:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to load NP2 file');
    }
  }, []);

  // NP2 인쇄 핸들러
  const handlePrint = useCallback(async (settings: PrintSettings) => {
    if (!selectedNp2) return;

    setIsPrintDialogOpen(false);
    setIsPrinting(true);

    try {
      // PDF 데이터 디코딩
      const pdfBase64 = selectedNp2.pdfBase64;
      const binaryString = atob(pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pdfBuffer = bytes.buffer;

      // SOBP 정보
      const { section, owner, book, pageStart } = selectedNp2.sobp;
      const pageCount = selectedNp2.sobp.pageEnd - selectedNp2.sobp.pageStart + 1;

      // 페이지 정보 생성
      const pages = createPagesFromNcode(
        { section, owner, bookCode: book, pageStart },
        pageCount
      );

      // NCode PDF 생성
      const result = await generateNcodePdf({
        buffer: pdfBuffer,
        paperGroupId: `${section}_${owner}_${book}`,
        docName: selectedNp2.title,
        printInBlue: settings.printInBlue,
        ncodeGlyphScale: settings.ncodeGlyphScale,
        pages,
        onProgress: (status, percent, subStatus) => {
          setPrintProgress({ status: subStatus ? `${status} (${subStatus})` : status, percent });
        },
      });

      // PDF 다운로드
      const filename = generateNcodePdfFilename(
        selectedNp2.title,
        { section, owner, book, pageStart },
        settings.printInBlue,
        settings.ncodeGlyphScale
      );
      downloadPdf(result.pdfBytes, filename);

      setPrintProgress(null);
      setSelectedNp2(null);
    } catch (error) {
      console.error('Print failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Print failed');
    } finally {
      setIsPrinting(false);
      setPrintProgress(null);
    }
  }, [selectedNp2]);

  // 파일 크기 포맷
  const formatFileSize = (bytes: number) => {
    return fileUploadService.formatFileSize(bytes);
  };

  // 파일 아이콘 가져오기
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (mimeType === 'application/pdf') {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    // NP2 파일
    if (mimeType === 'application/json' || mimeType === 'application/octet-stream') {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  // 파일 메시지 렌더링
  const renderFileMessage = (message: ChatMessage) => {
    if (!message.attachments || message.attachments.length === 0) return null;

    return (
      <div className="space-y-2">
        {message.attachments.map((attachment) => (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2 bg-white/50 rounded-lg border border-gray-200/50 hover:bg-white/80 transition-colors"
            onClick={(e) => {
              // NP2 파일인 경우 인쇄 다이얼로그 표시
              if (attachment.filename.endsWith('.np2')) {
                e.preventDefault();
                handleNp2Click(attachment);
              }
            }}
          >
            <div className="text-gray-500">
              {getFileIcon(attachment.mimeType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-700 truncate">
                {attachment.filename}
              </div>
              <div className="text-xs text-gray-400">
                {formatFileSize(attachment.size)}
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        ))}
        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
      </div>
    );
  };

  // 메시지 전송 핸들러
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const success = chatService.sendMessage(inputValue);
    if (success) {
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  // 입력 변경 핸들러 (타이핑 인디케이터)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.trim()) {
      chatService.startTyping();
    } else {
      chatService.stopTyping();
    }
  };

  // Enter 키 핸들러
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 시간 포맷
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 타이핑 중인 사용자 목록
  const typingUsersList = Array.from(typingUsers.values())
    .filter((u) => u.isTyping && u.userId !== currentUserId);

  return (
    <div
      ref={dropZoneRef}
      className="flex flex-col h-full bg-white/60 backdrop-blur-md relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 드래그 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm z-50 flex items-center justify-center border-2 border-dashed border-blue-500 rounded-lg m-2">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-blue-600 font-medium">{t('chat.dropFileHere', 'Drop file here')}</p>
          </div>
        </div>
      )}

      {/* 파일 입력 (숨김) */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept=".np2,.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt"
      />

      <PanelHeader
        title={t('chat.title', 'Chat')}
        onClose={() => setActiveRightPanel(null)}
      />

      {/* 연결 상태 표시 */}
      {!isConnected && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 text-yellow-700 text-xs flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          {t('chat.connecting', 'Connecting...')}
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">{t('chat.noMessages', 'No messages yet')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('chat.startConversation', 'Start the conversation!')}</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.userId === currentUserId;
            const isSystem = message.type === 'system';
            const userColor = getUserColor(message.userId);

            // 시스템 메시지
            if (isSystem) {
              return (
                <div key={message.id} className="text-center py-2">
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {message.content}
                  </span>
                </div>
              );
            }

            // 파일 메시지
            const isFileMessage = message.type === 'file';

            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isOwn ? 'order-2' : ''}`}>
                  {!isOwn && (
                    <div className="flex items-center gap-1 mb-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: userColor }}
                      />
                      <span className="text-xs font-medium text-gray-600">
                        {message.userName}
                      </span>
                    </div>
                  )}
                  <div
                    className={`px-3 py-2 rounded-lg ${
                      isOwn
                        ? isFileMessage ? 'bg-blue-100 text-gray-800 rounded-br-none' : 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {isFileMessage ? (
                      renderFileMessage(message)
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    )}
                  </div>
                  <div className={`text-[10px] text-gray-400 mt-1 ${isOwn ? 'text-right' : ''}`}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* 타이핑 인디케이터 */}
        {typingUsersList.length > 0 && (
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {typingUsersList.length === 1
                ? t('chat.isTyping', '{{name}} is typing...', { name: typingUsersList[0].userName })
                : t('chat.areTyping', '{{count}} people are typing...', { count: typingUsersList.length })}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 업로드 진행률 표시 */}
      {uploadProgress && (
        <div className="px-3 py-2 bg-blue-50 border-t border-blue-100">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-blue-600">{uploadProgress.percent}%</span>
          </div>
        </div>
      )}

      {/* 업로드 에러 표시 */}
      {uploadError && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-100 flex items-center justify-between">
          <span className="text-xs text-red-600">{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="p-3 border-t border-gray-200/50 bg-white/50">
        <div className="flex items-end gap-2">
          {/* 파일 첨부 버튼 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected || uploadProgress !== null}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={t('chat.attachFile', 'Attach file')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={t('chat.placeholder', 'Type a message...')}
            className="flex-1 px-3 py-2 bg-gray-100/80 border border-gray-200/50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
            rows={1}
            style={{ minHeight: '38px', maxHeight: '100px' }}
            disabled={!isConnected}
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || !isConnected}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* 인쇄 설정 다이얼로그 */}
      <PrintSettingsDialog
        isOpen={isPrintDialogOpen}
        onConfirm={handlePrint}
        onCancel={() => {
          setIsPrintDialogOpen(false);
          setSelectedNp2(null);
        }}
        confirmLabel={t('common.download', 'Download')}
      />

      {/* 인쇄 진행 오버레이 */}
      {isPrinting && printProgress && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-800 font-medium mb-2">
              {t('print.generating', 'Generating NCode PDF...')}
            </p>
            <p className="text-sm text-gray-500">{printProgress.status}</p>
            <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${printProgress.percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{printProgress.percent}%</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
