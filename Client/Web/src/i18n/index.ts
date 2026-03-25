import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all locale files
import ko from './locales/ko.json';
import ja from './locales/ja.json';
import enUS from './locales/en-US.json';
import enGB from './locales/en-GB.json';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import vi from './locales/vi.json';
import ms from './locales/ms.json';
import th from './locales/th.json';
import id from './locales/id.json';
import fil from './locales/fil.json';
import ar from './locales/ar.json';

// Language-specific font stacks (Noto Sans prioritized for consistent cross-platform rendering)
export const LANGUAGE_FONTS: Record<string, string> = {
  // Korean
  'ko': "'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",

  // Japanese - Meiryo UI first (Windows), then Noto Sans JP (web), then Hiragino (macOS)
  'ja': "'Meiryo UI', 'Meiryo', 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif",

  // Chinese Simplified
  'zh-CN': "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",

  // Chinese Traditional
  'zh-TW': "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",

  // Thai
  'th': "'Noto Sans Thai', 'Thonburi', 'Leelawadee UI', sans-serif",

  // Arabic
  'ar': "'Noto Sans Arabic', 'Geeza Pro', 'Segoe UI', sans-serif",

  // Vietnamese
  'vi': "'Noto Sans', system-ui, 'Segoe UI', sans-serif",

  // Latin-based languages (English, German, French, Spanish, Indonesian, Malay, Filipino)
  'default': "'Noto Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
};

export const SUPPORTED_LANGUAGES = [
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', flag: '🇹🇼' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

const resources = {
  ko: { translation: ko },
  ja: { translation: ja },
  'en-US': { translation: enUS },
  'en-GB': { translation: enGB },
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
  vi: { translation: vi },
  ms: { translation: ms },
  th: { translation: th },
  id: { translation: id },
  fil: { translation: fil },
  ar: { translation: ar },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'livecast:language',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: true,
    },
  });

// Helper function to get font family for a language
const getFontFamily = (lng: string): string => {
  return LANGUAGE_FONTS[lng] || LANGUAGE_FONTS['default'];
};

// RTL and font handling
i18n.on('languageChanged', (lng) => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === lng);

  // Set text direction
  document.documentElement.dir = lang && 'rtl' in lang && lang.rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;

  // Set language-specific font
  document.documentElement.style.setProperty('--font-family', getFontFamily(lng));
  document.body.style.fontFamily = getFontFamily(lng);
});

// Set initial direction and font
const initialLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language);
if (initialLang && 'rtl' in initialLang && initialLang.rtl) {
  document.documentElement.dir = 'rtl';
}
// Set initial font
document.documentElement.style.setProperty('--font-family', getFontFamily(i18n.language));
document.body.style.fontFamily = getFontFamily(i18n.language);

export default i18n;
