import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useAppLanguage from '@/hooks/useAppLanguage';
import type { PublicTravellerDetail } from '@/lib/travellerPrivacy';
import styles from '@/styles/Travellers.module.css';

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  };
}

export async function getStaticProps() {
  return {
    props: {},
  };
}

export default function TravellerProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const { language, t } = useAppLanguage();

  const [traveller, setTraveller] = useState<PublicTravellerDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'idle' | 'error' | 'notFound'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedCountries, setExpandedCountries] = useState<Record<number, boolean>>({});

  const loadProfile = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch(`/api/travellers/${encodeURIComponent(id)}`);
      if (response.status === 404) {
        setStatus('notFound');
        return;
      }

      if (!response.ok) {
        throw new Error(t('travellersLoadError'));
      }

      const data = await response.json();
      if (!data.traveller) {
        setStatus('notFound');
        return;
      }

      setTraveller(data.traveller);
      setStatus('idle');
    } catch (err) {
      console.error('Failed to load traveller profile:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : t('travellersLoadError'));
    }
  }, [id, t]);

  useEffect(() => {
    if (router.isReady && id) {
      void loadProfile();
    }
  }, [id, loadProfile, router.isReady]);

  const toggleCountryExpanded = (countryId: number) => {
    setExpandedCountries((prev) => ({
      ...prev,
      [countryId]: !prev[countryId],
    }));
  };

  const locale = language === 'uk' ? 'uk-UA' : 'en-US';
  const totalWorldCountries = 250;
  const countryCount = traveller?.counter || traveller?.visitedCountries.length || 0;
  const totalCitiesCount = traveller?.cities.length || 0;
  const progressPercent = Math.min(
    100,
    Math.round((countryCount / totalWorldCountries) * 100),
  );

  return (
    <div className={styles.page}>
      <nav aria-label={t('backToTravellers')}>
        <Link href="/travellers" className={styles.backLink}>
          ← {t('backToTravellers')}
        </Link>
      </nav>

      {status === 'loading' && (
        <div className={styles.loadingState}>
          <p>{t('loadingTravellers')}</p>
        </div>
      )}

      {status === 'notFound' && (
        <div className={styles.emptyState}>
          <p>{t('travellerNotFound')}</p>
          <Link href="/travellers" className={styles.retryBtn}>
            {t('backToTravellers')}
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className={styles.errorState} role="alert">
          <p>{errorMessage || t('travellersLoadError')}</p>
          <button type="button" className={styles.retryBtn} onClick={() => void loadProfile()}>
            {t('retry')}
          </button>
        </div>
      )}

      {status === 'idle' && traveller && (
        <>
          <section className={styles.profileHeader}>
            {traveller.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={traveller.avatar}
                alt=""
                className={styles.profileAvatar}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={styles.profileAvatarFallback} aria-hidden="true">
                {traveller.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className={styles.profileDetails}>
              <h1 className={styles.profileName}>{traveller.name}</h1>
              <div className={styles.profileStats}>
                <div className={styles.statPill}>
                  <span>{t('visitedCountries')}</span>
                  <strong>{new Intl.NumberFormat(locale).format(countryCount)}</strong>
                </div>
                <div className={styles.statPill}>
                  <span>{t('citiesVisited')}</span>
                  <strong>{new Intl.NumberFormat(locale).format(totalCitiesCount)}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.progressSection} aria-label={`${progressPercent}%`}>
            <div
              className={styles.pieChartContainer}
              style={{
                background: `conic-gradient(#2c8a67 ${progressPercent}%, #e2e8f0 ${progressPercent}% 100%)`,
              }}
              role="img"
              aria-label={`${progressPercent}%`}
            >
              <div
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className={styles.pieChartLabel}>{progressPercent}%</span>
              </div>
            </div>
            <div>
              <strong style={{ fontSize: '1.125rem', color: '#0f172a', display: 'block' }}>
                {t('visitedCountriesCount').replace(
                  '{count}',
                  new Intl.NumberFormat(locale).format(countryCount),
                )}
              </strong>
              <span style={{ fontSize: '0.9375rem', color: '#64748b' }}>
                {t('ofCountries').replace(
                  '{count}',
                  new Intl.NumberFormat(locale).format(totalWorldCountries),
                )}
              </span>
            </div>
          </section>

          <section className={styles.countriesListSection} aria-label={t('visitedCountries')}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {t('visitedCountries')}
            </h2>

            {traveller.visitedCountries.length === 0 ? (
              <p style={{ color: '#64748b' }}>{t('noVisitedCountriesPublic')}</p>
            ) : (
              traveller.visitedCountries.map((country) => {
                const countryCities = traveller.cities.filter(
                  (city) => city.parentId === country.id,
                );
                const isExpanded = Boolean(expandedCountries[country.id]);

                return (
                  <div key={country.id || country.shortName} className={styles.countryCard}>
                    <div
                      className={styles.countryHeader}
                      onClick={() => toggleCountryExpanded(country.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleCountryExpanded(country.id);
                        }
                      }}
                    >
                      <div className={styles.countryMain}>
                        <span className={styles.countryFlag} role="img" aria-label={country.name}>
                          {country.flag || '🏳️'}
                        </span>
                        <span className={styles.countryName}>{country.name}</span>
                      </div>
                      {countryCities.length > 0 && (
                        <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>
                          {countryCities.length} {t('cities').toLowerCase()} {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </div>

                    {isExpanded && countryCities.length > 0 && (
                      <div className={styles.citiesList}>
                        {countryCities.map((city) => (
                          <div key={city.id || city.name} className={styles.cityChip}>
                            <span>📍 {city.name}</span>
                            {city.month && (
                              <small style={{ color: '#64748b' }}>({city.month})</small>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}
