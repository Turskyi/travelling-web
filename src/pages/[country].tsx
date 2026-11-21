import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import useAppLanguage from '@/hooks/useAppLanguage';
import useCountry from '@/hooks/useCountry';
import useTravelTracker from '@/hooks/useTravelTracker';
import { getCountryDisplayName } from '@/lib/countryLocalization';
import styles from '@/styles/Tracker.module.css';

export default function CountryDetailsPage() {
  const router = useRouter();
  const countryName = router.query.country?.toString() || '';
  const { country, countryLoading, countryError } = useCountry(countryName);
  const { language, t } = useAppLanguage();
  const { history, ready, storageError, setVisited, addCity, updateCity, removeCity } =
    useTravelTracker();
  const [cityName, setCityName] = useState('');
  const [cityMonth, setCityMonth] = useState('');
  const [editingCityId, setEditingCityId] = useState('');
  const [formError, setFormError] = useState('');

  const countryKey = country?.cca3 || country?.name.common.toLowerCase() || '';
  const record = country ? history[countryKey] : undefined;
  const isVisited = Boolean(record?.isVisited);
  const locale = language === 'uk' ? 'uk-UA' : 'en-US';
  const displayName = country ? getCountryDisplayName(country, language) : '';
  const languages = useMemo(
    () => (country?.languages ? Object.values(country.languages) : []),
    [country],
  );
  const cities = record?.cities || [];

  const submitCity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!country) return;
    const cleanName = cityName.trim();
    if (!cleanName) {
      setFormError(t('cityRequired'));
      return;
    }
    if (!cityMonth) {
      setFormError(t('cityMonthRequired'));
      return;
    }
    if (editingCityId) {
      updateCity(country, editingCityId, cleanName, cityMonth);
      setEditingCityId('');
    } else {
      addCity(country, cleanName, cityMonth);
    }
    setCityName('');
    setCityMonth('');
    setFormError('');
  };

  const editCity = (city: { id: string; name: string; month: string }) => {
    setEditingCityId(city.id);
    setCityName(city.name);
    setCityMonth(city.month);
    setFormError('');
  };

  const cancelEdit = () => {
    setEditingCityId('');
    setCityName('');
    setCityMonth('');
    setFormError('');
  };

  const deleteCity = (cityId: string) => {
    if (country && window.confirm(t('cityRemoveConfirm'))) removeCity(country, cityId);
  };

  return (
    <>
      <Head>
        <title>{displayName ? `${displayName} | Travelling` : 'Travelling'}</title>
      </Head>
      <div className={styles.detailPage}>
        <Link className={styles.backLink} href="/">{`← ${t('back')}`}</Link>
        {countryLoading && <p className={styles.status}>{t('loadingCountries')}</p>}
        {(countryError || (!countryLoading && !country)) && (
          <p className={styles.errorBanner} role="alert">
            {country ? t('countryLoadError') : t('countryNotFound')}
          </p>
        )}
        {country && (
          <>
            <section className={styles.detailHero}>
              <Image
                src={country.flags.svg || country.flags.png}
                alt={`${displayName} flag`}
                width={520}
                height={320}
                className={styles.detailFlag}
                priority
              />
              <div className={styles.detailInfo}>
                <span className={styles.eyebrow}>{t('travelJournal')}</span>
                <h1>{displayName}</h1>
                <p>{country.name.official}</p>
                <button
                  type="button"
                  className={isVisited ? styles.visitedButton : styles.visitButton}
                  aria-pressed={isVisited}
                  disabled={!ready || Boolean(storageError) || !countryKey}
                  onClick={() => setVisited(country, !isVisited)}
                >
                  {isVisited ? `✓ ${t('markNotVisited')}` : t('markVisited')}
                </button>
                <dl className={styles.countryFacts}>
                  <div>
                    <dt>{t('capital')}</dt>
                    <dd>{country.capital?.join(', ') || '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('population')}</dt>
                    <dd>
                      {typeof country.population === 'number'
                        ? new Intl.NumberFormat(locale).format(country.population)
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('languages')}</dt>
                    <dd>{languages.join(', ') || '—'}</dd>
                  </div>
                </dl>
                <a
                  className={styles.mapLink}
                  href={country.maps.googleMaps}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('map')} ↗
                </a>
              </div>
            </section>

            {storageError && <p className={styles.errorBanner} role="alert">{t('storageError')}</p>}

            <section className={styles.citySection}>
              <div className={styles.cityHeading}>
                <div>
                  <h2>{t('cities')}</h2>
                  <p>{cities.length}</p>
                </div>
              </div>
              <form className={styles.cityForm} onSubmit={submitCity}>
                <label>
                  <span>{t('cityName')}</span>
                  <input
                    value={cityName}
                    onChange={(event) => setCityName(event.target.value)}
                    maxLength={100}
                    disabled={!ready || storageError !== ''}
                    required
                  />
                </label>
                <label>
                  <span>{t('monthVisited')}</span>
                  <input
                    type="month"
                    value={cityMonth}
                    onChange={(event) => setCityMonth(event.target.value)}
                    disabled={!ready || storageError !== ''}
                    required
                  />
                </label>
                <div className={styles.formActions}>
                  <button className={styles.primaryAction} type="submit" disabled={!ready || storageError !== ''}>
                    {editingCityId ? t('saveCity') : t('addCity')}
                  </button>
                  {editingCityId && (
                    <button className={styles.secondaryAction} type="button" onClick={cancelEdit}>
                      {t('cancel')}
                    </button>
                  )}
                </div>
                {formError && <p className={styles.formError} role="alert">{formError}</p>}
              </form>

              {cities.length === 0 ? (
                <p className={styles.emptyState}>{t('noCities')}</p>
              ) : (
                <ul className={styles.cityList}>
                  {cities.map((city) => {
                    const monthDate = city.month
                      ? new Date(`${city.month}-01T00:00:00`)
                      : null;
                    const monthLabel =
                      monthDate && !Number.isNaN(monthDate.getTime())
                        ? new Intl.DateTimeFormat(locale, {
                            month: 'long',
                            year: 'numeric',
                          }).format(monthDate)
                        : '';
                    return (
                      <li key={city.id}>
                        <div>
                          <strong>{city.name}</strong>
                          {monthLabel && <span>{monthLabel}</span>}
                        </div>
                        <div className={styles.cityActions}>
                          <button type="button" disabled={!ready || Boolean(storageError)} onClick={() => editCity(city)}>{t('edit')}</button>
                          <button type="button" disabled={!ready || Boolean(storageError)} onClick={() => deleteCity(city.id)}>{t('remove')}</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
