import Head from 'next/head';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from '@/styles/PolicyPage.module.css';

type PolicyPageProps = {
  title: string;
  children: ReactNode;
};

export default function PolicyPage({ title, children }: PolicyPageProps) {
  const pageTitle = `${title} | Travelling`;
  const metaDescription = `${title} for the Travelling app and website.`;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="robots" content="index, follow" />
      </Head>
      <div className={styles.page}>
        <article className={styles.document}>
          <Link className={styles.brand} href="/">
            Travelling
          </Link>
          <div className={styles.content}>
            <header className={styles.header}>
              <p className={styles.eyebrow}>Travelling</p>
              <h1>{title}</h1>
              <p className={styles.updated}>Last updated: November 14, 2026</p>
            </header>
            {children}
            <footer className={styles.footer}>
              <Link href="/terms">Terms of Service</Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacy">Privacy Policy</Link>
              <span aria-hidden="true">·</span>
              <a href="mailto:dmitriy.turskiy@gmail.com">Contact</a>
            </footer>
          </div>
        </article>
      </div>
    </>
  );
}
