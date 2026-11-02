import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Locale } from '../../../contracts/identity.js';
import { ar } from './catalog-ar.js';
import { en, type MessageKey } from './catalog-en.js';

const CATALOGS: Record<Locale, Record<MessageKey, string>> = { ar, en };
const STORAGE_KEY = 'qb.locale';

interface I18n {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: MessageKey): string;
}

const I18nContext = createContext<I18n | null>(null);

function initialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ar' || stored === 'en') return stored;
  return navigator.language.startsWith('ar') ? 'ar' : 'en';
}

/** UI language only: question text keeps its own language and direction (FR-01-007). */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);
  const t = useCallback((key: MessageKey) => CATALOGS[locale][key], [locale]);
  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export type { MessageKey };
