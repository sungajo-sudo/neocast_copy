import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMessengerStore, type Message, type DmAttachment, type TypingIndicator } from '../../stores/messenger-store';
import { messengerService } from '../../services/messenger-service';
import { fileUploadService, type UploadProgress } from '../../services/file-upload.service';
import { useShallow } from 'zustand/react/shallow';

interface SessionInfo {
  sessionCode?: string;
  hostName?: string;
  participantNames?: string[];
}

interface ChatViewProps {
  threadId: string;
  participantName: string;
  currentUserId: string;
  onBack?: () => void;
  isSessionChat?: boolean;
  sessionInfo?: SessionInfo;
}

/**
 * 대화창 컴포넌트
 */
export const ChatView: React.FC<ChatViewProps> = ({
  threadId,
  participantName,
  currentUserId,
  onBack,
  isSessionChat = false,
  sessionInfo,
}) => {
  const { t } = useTranslation();

  // useShallow를 사용하여 안정적인 참조 유지
  const { messages, hasMore, isLoadingMessages, isSendingMessage, typingIndicator } = useMessengerStore(
    useShallow((state) => {
      // 메시지 배열 (존재하지 않으면 undefined로 유지하여 새 배열 생성 방지)
      const msgs = state.messagesByThread.get(threadId);
      // 타이핑 인디케이터 찾기
      let typing: TypingIndicator | undefined;
      for (const indicator of state.typingIndicators.values()) {
        if (indicator.threadId === threadId && indicator.isTyping) {
          typing = indicator;
          break;
        }
      }
      return {
        messages: msgs,
        hasMore: state.hasMoreByThread.get(threadId) ?? true,
        isLoadingMessages: state.isLoadingMessages,
        isSendingMessage: state.isSendingMessage,
        typingIndicator: typing,
      };
    })
  );

  // 메시지 배열이 없으면 빈 배열 사용 (useMemo로 안정적인 참조)
  const messageList: Message[] = useMemo(() => messages ?? [], [messages]);

  const [inputValue, setInputValue] = useState('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 메시지 로드
  useEffect(() => {
    if (threadId && messageList.length === 0) {
      messengerService.loadMessages(threadId, isSessionChat).catch(console.error);
    }
    // 읽음 처리 (세션 채팅은 읽음 처리 안함)
    if (!isSessionChat) {
      messengerService.markAsRead(threadId);
    }
  }, [threadId, messageList.length, isSessionChat]);

  // 새 메시지시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageList.length]);

  // 파일 업로드 핸들러
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploadError(null);

    for (const file of fileArray) {
      const validation = fileUploadService.validateFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid file');
        continue;
      }

      try {
        const result = await fileUploadService.uploadFile(file, undefined, (progress) => {
          setUploadProgress(progress);
        });

        const attachment: DmAttachment = {
          id: result.fileId,
          filename: result.filename,
          mimeType: result.mimeType,
          size: result.size,
          url: result.url,
        };

        messengerService.sendMessage(threadId, '', [attachment]);
        setUploadProgress(null);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Upload failed');
        setUploadProgress(null);
      }
    }
  }, [threadId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
      e.target.value = '';
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || isSendingMessage) return;

    const success = messengerService.sendMessage(threadId, inputValue.trim());
    if (success) {
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // IME 조합 중일 때는 무시 (한글, 일본어 등)
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    messengerService.startTypingIndicator(threadId);
  };

  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMessages) return;
    await messengerService.loadMoreMessages(threadId, isSessionChat);
  };

  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('messenger.time.today', 'Today');
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t('messenger.time.yesterday', 'Yesterday');
    } else {
      return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    }
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number) => {
    return fileUploadService.formatFileSize(bytes);
  };

  // 파일 아이콘
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
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  // 첨부파일 렌더링
  const renderAttachments = (attachments: DmAttachment[], isOwn: boolean) => {
    return (
      <div className="space-y-1.5">
        {attachments.map((attachment) => {
          const isImage = attachment.mimeType.startsWith('image/');

          if (isImage) {
            return (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  className="max-w-48 max-h-48 rounded object-cover"
                  loading="lazy"
                />
                <div className={`text-[10px] mt-0.5 ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                  {attachment.filename} ({formatFileSize(attachment.size)})
                </div>
              </a>
            );
          }

          return (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                isOwn
                  ? 'bg-blue-400/30 border-blue-400/30 hover:bg-blue-400/50'
                  : 'bg-white/50 border-gray-200/50 hover:bg-white/80'
              }`}
            >
              <div className={isOwn ? 'text-blue-100' : 'text-gray-500'}>
                {getFileIcon(attachment.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-gray-700'}`}>
                  {attachment.filename}
                </div>
                <div className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                  {formatFileSize(attachment.size)}
                </div>
              </div>
              <svg className={`w-4 h-4 flex-shrink-0 ${isOwn ? 'text-blue-200' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          );
        })}
      </div>
    );
  };

  // 날짜별로 메시지 그룹화
  const groupedMessages = messageList.reduce<{ date: string; messages: Message[] }[]>((groups, message) => {
    const dateStr = new Date(message.createdAt).toDateString();
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && new Date(lastGroup.messages[0].createdAt).toDateString() === dateStr) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ date: dateStr, messages: [message] });
    }

    return groups;
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1 hover:bg-gray-200 rounded transition-colors md:hidden"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
            isSessionChat
              ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
              : 'bg-gray-200 text-gray-600'
          }`}
        >
          {isSessionChat ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          ) : (
            participantName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800 truncate">{participantName}</span>
            {isSessionChat && (
              <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-600 rounded font-medium flex-shrink-0">
                {t('messenger.session', 'Session')}
              </span>
            )}
          </div>
          {isSessionChat && sessionInfo?.participantNames && sessionInfo.participantNames.length > 0 ? (
            <div className="text-xs text-gray-500 truncate">
              {sessionInfo.participantNames.slice(0, 5).join(', ')}
              {sessionInfo.participantNames.length > 5
                ? ` +${sessionInfo.participantNames.length - 5}`
                : ''}
            </div>
          ) : typingIndicator ? (
            <div className="text-xs text-gray-500">
              {t('messenger.typing', 'Typing...')}
            </div>
          ) : null}
        </div>
      </div>

      {/* 메시지 목록 */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 더 불러오기 버튼 */}
        {hasMore && (
          <div className="text-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMessages}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
            >
              {isLoadingMessages
                ? t('common.loading', 'Loading...')
                : t('messenger.loadMore', 'Load older messages')}
            </button>
          </div>
        )}

        {/* 메시지가 없는 경우 */}
        {messageList.length === 0 && !isLoadingMessages && (
          <div className="text-center text-gray-500 py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">{t('messenger.noMessages', 'No messages yet')}</p>
            <p className="text-xs text-gray-400 mt-1">
              {t('messenger.startDm', 'Send a direct message!')}
            </p>
          </div>
        )}

        {/* 날짜별 그룹화된 메시지 */}
        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* 날짜 구분선 */}
            <div className="flex items-center justify-center my-4">
              <div className="px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                {formatDate(group.messages[0].createdAt)}
              </div>
            </div>

            {/* 메시지들 */}
            {group.messages.map((message) => {
              const isOwn = message.senderId === currentUserId;
              const hasAttachments = message.attachments && message.attachments.length > 0;
              const hasContent = !!message.content;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  <div className="max-w-[75%]">
                    <div
                      className={`px-3 py-2 rounded-lg ${
                        isOwn
                          ? 'bg-blue-500 text-white rounded-br-none'
                          : 'bg-gray-100 text-gray-800 rounded-bl-none'
                      }`}
                    >
                      {hasAttachments && renderAttachments(message.attachments!, isOwn)}
                      {hasContent && (
                        <p className={`text-sm whitespace-pre-wrap break-words ${hasAttachments ? 'mt-1.5' : ''}`}>
                          {message.content}
                        </p>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                      <span className="text-[10px] text-gray-400">{formatTime(message.createdAt)}</span>
                      {isOwn && message.readAt && (
                        <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* 타이핑 인디케이터 */}
        {typingIndicator && (
          <div className="flex justify-start">
            <div className="px-3 py-2 bg-gray-100 rounded-lg rounded-bl-none">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 - 세션 채팅은 읽기 전용 */}
      {isSessionChat ? (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="text-center text-xs text-gray-500">
            {t('messenger.sessionChatReadOnly', 'This is a session chat history. To send messages, join the session.')}
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-200 bg-white">
          {/* 업로드 진행률 */}
          {uploadProgress && (
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
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

          {/* 업로드 에러 */}
          {uploadError && (
            <div className="px-3 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <span className="text-xs text-red-600">{uploadError}</span>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* 숨겨진 파일 입력 */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="p-3">
            <div className="flex items-end gap-2">
              {/* 파일 첨부 버튼 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadProgress !== null}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={t('messenger.attachFile', 'Attach file')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <textarea
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder={t('messenger.placeholder', 'Type a message...')}
                className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                rows={1}
                style={{ minHeight: '38px', maxHeight: '100px' }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputValue.trim() || isSendingMessage}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSendingMessage ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;
