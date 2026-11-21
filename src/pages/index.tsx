import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import useAppLanguage from '@/hooks/useAppLanguage';
import useTravelTracker from '@/hooks/useTravelTracker';
import { getCountryDisplayName } from '@/lib/countryLocalization';
import type { Country } from '@/models/Country';
import * as CountryApi from '@/network/country-api';
import styles from '@/styles/Tracker.module.css';

type CountryFilter = 'all' | 'visited' | 'notVisited';

export default function Home() {
  const { language, t } = useAppLanguage();
  const { data: countries, error, isLoading, mutate } = useSWR<Country[]>(
    'all-countries',
    CountryApi.getCountries,
  );
  const { history, ready, storageError, setVisited } = useTravelTracker();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CountryFilter>('all');

  const visitedCount = useMemo(
    () => (countries || []).filter((country) => history[country.cca3 || '']?.isVisited).length,
    [countries, history],
  );
  const cityCount = Object.values(history).reduce(
    (count, record) => count + record.cities.length,
    0,
  );
  const totalCountries = countries?.length || 0;
  const progress = totalCountries ? Math.round((visitedCount / totalCountries) * 100) : 0;
  const locale = language === 'uk' ? 'uk-UA' : 'en-US';
  const formattedCount = new Intl.NumberFormat(locale).format(visitedCount);
  const formattedTotal = countries
    ? new Intl.NumberFormat(locale).format(totalCountries)
    : '—';
  const totalLabel = t('ofCountries').replace('{count}', formattedTotal);

  const visibleCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return (countries || [])
      .filter((country) => {
        const isVisited = Boolean(history[country.cca3 || '']?.isVisited);
        if (filter === 'visited' && !isVisited) return false;
        if (filter === 'notVisited' && isVisited) return false;
        if (!normalizedQuery) return true;
        return [
          country.name.common,
          country.name.official,
          getCountryDisplayName(country, language),
        ].some((name) => name.toLocaleLowerCase(locale).includes(normalizedQuery));
      })
      .sort((first, second) =>
        getCountryDisplayName(first, language).localeCompare(
          getCountryDisplayName(second, language),
          locale,
        ),
      );
  }, [countries, filter, history, language, locale, query]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{t('travelJournal')}</span>
          <h1>{t('title')}</h1>
          <p>{t('subtitle')}</p>
        </div>
        <div className={styles.progressCard} aria-label={`${progress}%`}>
          <div
            className={styles.progressRing}
            style={{
              background: `conic-gradient(#2c8a67 ${progress}%, #e8eee9 ${progress}% 100%)`,
            }}
            role="img"
            aria-label={`${progress}%`}
          >
            <span>{progress}%</span>
          </div>
          <div className={styles.progressText}>
            <strong>{formattedCount} {t('visitedCountries').toLocaleLowerCase(locale)}</strong>
            <span>{totalLabel}</span>
          </div>
        </div>
      </section>

      <section className={styles.stats} aria-label={t('visitedCountries')}>
        <div className={styles.stat}>
          <span>{t('visitedCountries')}</span>
          <strong>{formattedCount}<small> / {formattedTotal}</small></strong>
        </div>
        <div className={styles.stat}>
          <span>{t('citiesVisited')}</span>
          <strong>{new Intl.NumberFormat(locale).format(cityCount)}</strong>
        </div>
        <p className={styles.localNote}>{t('localDataNote')}</p>
      </section>

      {storageError && <p className={styles.errorBanner} role="alert">{t('storageError')}</p>}

      <section className={styles.countrySection}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>{t('explore')}</h2>
            <span>
              {countries
                ? `${visibleCountries.length} / ${totalCountries}`
                : isLoading
                  ? t('loadingCountries')
                  : '—'}
            </span>
          </div>
          <label className={styles.search}>
            <span className={styles.visuallyHidden}>{t('searchCountries')}</span>
            <input
              type="search"
              placeholder={t('searchCountries')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span aria-hidden="true">⌕</span>
          </label>
        </div>

        <div className={styles.filters} role="group" aria-label={t('explore')}>
          {(['all', 'visited', 'notVisited'] as const).map((filterOption) => {
            const label = filterOption === 'all'
              ? t('allCountries')
              : filterOption === 'visited'
                ? t('visited')
                : t('notVisited');
            return (
              <button
                key={filterOption}
                type="button"
                className={filter === filterOption ? styles.activeFilter : ''}
                aria-pressed={filter === filterOption}
                onClick={() => setFilter(filterOption)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <span>{t('countryLoadError')}</span>
            <button type="button" onClick={() => void mutate()}>{t('retry')}</button>
          </div>
        )}
        {!error && isLoading && <p className={styles.status}>{t('loadingCountries')}</p>}
        {!error && !isLoading && visibleCountries.length === 0 && (
          <p className={styles.emptyState}>{t('noCountries')}</p>
        )}
        {countries && visibleCountries.length > 0 && (
          <div className={styles.countryGrid}>
            {visibleCountries.map((country) => {
              const isVisited = Boolean(history[country.cca3 || '']?.isVisited);
              return (
                <article className={styles.countryCard} key={country.cca3 || country.name.official}>
                  <Link
                    className={styles.flagLink}
                    href={`/${encodeURIComponent(country.name.official)}`}
                    aria-label={`${t('details')}: ${getCountryDisplayName(country, language)}`}
                  >
                    <Image
                      src={country.flags.svg || country.flags.png}
                      alt=""
                      width={320}
                      height={180}
                      className={styles.flag}
                      sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 25vw"
                    />
                  </Link>
                  <div className={styles.cardContent}>
                    <Link
                      className={styles.countryName}
                      href={`/${encodeURIComponent(country.name.official)}`}
                    >
                      {getCountryDisplayName(country, language)}
                    </Link>
                    <button
                      type="button"
                      className={isVisited ? styles.visitedButton : styles.visitButton}
                      aria-pressed={isVisited}
                      disabled={!ready || Boolean(storageError)}
                      onClick={() => setVisited(country, !isVisited)}
                    >
                      {isVisited ? `✓ ${t('visited')}` : t('markVisited')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!ready && <span className={styles.visuallyHidden} aria-live="polite">Loading saved history</span>}
      </section>
    </div>
  );
}
