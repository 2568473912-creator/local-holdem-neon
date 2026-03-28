import { APP_LANGUAGES, type AppLanguage } from '../i18n';

export const LANGUAGE_STORAGE_KEY = 'neon.holdem.language-preferences.v1';

export function readLanguagePreference(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'zh-CN';
  }
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw && APP_LANGUAGES.includes(raw as AppLanguage)) {
      return raw as AppLanguage;
    }
  } catch {
    return 'zh-CN';
  }
  return 'zh-CN';
}

export function writeLanguagePreference(language: AppLanguage): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}
