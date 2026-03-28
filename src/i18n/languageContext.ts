import { createContext, useContext } from 'react';
import type { AppLanguage } from './index';

export const languageContext = createContext<AppLanguage>('zh-CN');

export function useLanguage(): AppLanguage {
  return useContext(languageContext);
}
