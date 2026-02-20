import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';

/**
 * About 모달
 * 서비스 소개
 */
export const AboutModal: React.FC = () => {
  const { t } = useTranslation();
  const isAboutOpen = usePanelStore((state) => state.isAboutOpen);
  const setAboutOpen = usePanelStore((state) => state.setAboutOpen);

  if (!isAboutOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setAboutOpen(false)}
      />

      {/* 모달 컨테이너 */}
      <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 w-full max-w-lg mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
                  <span className="text-gray-800">CAST</span>
                </h2>
                <p className="text-sm text-gray-500">v{__APP_VERSION__}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAboutOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="px-6 py-5 space-y-5">
          {/* 서비스 소개 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('about.whatIs', 'What is NeoCAST?')}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('about.description', 'NeoCAST is a real-time collaboration platform that supports various input tools including Neo Smartpen, stylus, touch, and mouse. Write, draw, and communicate freely anytime, anywhere.')}
            </p>
          </div>

          {/* 주요 기능 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('about.features', 'Key Features')}</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{t('about.feature1Title', 'Multi-Input Support')}</p>
                  <p className="text-xs text-gray-500">{t('about.feature1Desc', 'Neo Smartpen, stylus, touch, and mouse input')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{t('about.feature2Title', 'Real-time Collaboration')}</p>
                  <p className="text-xs text-gray-500">{t('about.feature2Desc', 'Share and collaborate with participants in real-time')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{t('about.feature3Title', 'PDF & NCode Support')}</p>
                  <p className="text-xs text-gray-500">{t('about.feature3Desc', 'Upload PDFs and use with Neo Smartpen NCode')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 저작권 */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              {t('common.copyright', '© 2026 NeoLAB Convergence. All rights reserved.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
