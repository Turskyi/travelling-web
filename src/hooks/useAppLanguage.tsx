import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { translations, type Language, type TranslationKey } from '@/lib/translations';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'travelling.language';

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const preferred = saved === 'uk' || saved === 'en'
      ? saved
      : navigator.language.toLowerCase().startsWith('uk')
        ? 'uk'
        : 'en';
    setLanguage(preferred);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        window.localStorage.setItem(STORAGE_KEY, nextLanguage);
        setLanguage(nextLanguage);
      },
      t: (key) => translations[language][key],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export default function useAppLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useAppLanguage must be used within LanguageProvider.');
  return context;
}
