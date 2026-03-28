import type { ReactNode } from 'react';
import type { AppLanguage } from './index';
import { languageContext } from './languageContext';

export function LanguageProvider({ language, children }: { language: AppLanguage; children: ReactNode }) {
  return <languageContext.Provider value={language}>{children}</languageContext.Provider>;
}
