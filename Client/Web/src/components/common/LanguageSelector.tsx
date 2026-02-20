import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n';

/**
 * Language selector dropdown for top bar
 */
export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get current language info
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)
    || SUPPORTED_LANGUAGES.find(l => l.code === 'en-US')!;

  // Check if current language is RTL
  const isRtl = 'rtl' in currentLang && currentLang.rtl;

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-medium text-gray-600 transition-colors border border-gray-200"
        title={currentLang.name}
      >
        <span className="text-sm">{currentLang.flag}</span>
        <span className="hidden min-[860px]:inline">{currentLang.nativeName}</span>
        <svg className="w-3 h-3 hidden min-[860px]:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-[calc(100vh-80px)] overflow-y-auto ${isRtl ? 'left-0' : 'right-0'}`}>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = i18n.language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center space-x-3 ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="flex-1">{lang.nativeName}</span>
                {isSelected && (
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
