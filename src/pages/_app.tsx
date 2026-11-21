import Head from 'next/head'
import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Link from 'next/link';
import type { ReactNode } from 'react';
import useAppLanguage, { LanguageProvider } from '@/hooks/useAppLanguage';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <Head>
        <meta name="description" content="A personal travel tracker for countries and cities you have visited." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <AppShell>
        <Component {...pageProps} />
      </AppShell>
    </LanguageProvider>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const { language, setLanguage, t } = useAppLanguage();
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/">{t('appName')}</Link>
        <nav aria-label={t('mainNavigation')}>
          <Link href="/">{t('explore')}</Link>
          <Link href="/privacy">{t('privacy')}</Link>
          <Link href="/terms">{t('terms')}</Link>
          <Link href="/account">{t('account')}</Link>
        </nav>
        <label className="language-picker">
          <span>{t('language')}</span>
          <select
            aria-label={t('language')}
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'uk')}
          >
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <span>Travelling</span>
        <span>{t('footerNote')}</span>
      </footer>
    </div>
  );
}
