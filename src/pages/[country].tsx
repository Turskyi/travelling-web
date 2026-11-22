import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/router';
import useAppLanguage from '@/hooks/useAppLanguage';
import useCountry from '@/hooks/useCountry';
import useTravelTracker from '@/hooks/useTravelTracker';
import { getCountryDisplayName } from '@/lib/countryLocalization';
import { loadLocalSelfie, removeLocalSelfie, saveLocalSelfie } from '@/lib/selfieStorage';
import { auth, googleProvider, signInWithPopup } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import styles from '@/styles/Tracker.module.css';

const MAX_SELFIE_SIZE = 2 * 1024 * 1024;
const SELFIE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read the selected image.'));
        return;
      }
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

export default function CountryDetailsPage() {
  const router = useRouter();
  const countryName = router.query.country?.toString() || '';
  const { country, countryLoading, countryError } = useCountry(countryName);
  const { language, t } = useAppLanguage();
  const { history, ready, storageError, setVisited, addCity, updateCity, removeCity, setSelfie, clearSelfie } =
    useTravelTracker();
  const [cityName, setCityName] = useState('');
  const [cityMonth, setCityMonth] = useState('');
  const [editingCityId, setEditingCityId] = useState('');
  const [formError, setFormError] = useState('');
  const [selfiePreview, setSelfiePreview] = useState('');
  const [selectedSelfie, setSelectedSelfie] = useState<Blob | null>(null);
  const [selfieMessage, setSelfieMessage] = useState('');
  const [selfieMessageIsError, setSelfieMessageIsError] = useState(false);
  const [selfieWorking, setSelfieWorking] = useState(false);
  const [authUserId, setAuthUserId] = useState('');

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
  const selfieId = record?.selfieId || '';

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setAuthUserId(user?.uid || ''));
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!ready || !selfieId) {
      setSelfiePreview('');
      return;
    }

    void loadLocalSelfie(selfieId)
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setSelfiePreview(objectUrl);
        setSelectedSelfie(blob);
      })
      .catch(() => {
        if (active) setSelfieMessage(t('selfieLocalError'));
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ready, selfieId, t]);

  useEffect(() => {
    if (!selfiePreview.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(selfiePreview);
  }, [selfiePreview]);

  useEffect(() => {
    let active = true;
    const user = auth.currentUser;
    if (!record?.selfieCloudPath || !user || !country) return;
    const params = new URLSearchParams({
      countryCode: country.cca3 || country.name.common.toLowerCase(),
      countryName: country.name.common,
    });
    void user.getIdToken()
      .then((token) =>
        fetch(`/api/sync/selfie?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as { url?: string };
        if (active && result.url && !selfiePreview) setSelfiePreview(result.url);
      })
      .catch(() => {
        if (active) setSelfieMessage(t('selfieUploadError'));
      });
    return () => {
      active = false;
    };
  }, [authUserId, country, record?.selfieCloudPath, selfiePreview, t]);

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

  const chooseSelfie = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !country) return;
    setSelfieMessage('');
    if (!SELFIE_TYPES.has(file.type)) {
      setSelfieMessage(t('selfieFileTypeError'));
      setSelfieMessageIsError(true);
      return;
    }
    if (file.size > MAX_SELFIE_SIZE) {
      setSelfieMessage(t('selfieFileSizeError'));
      setSelfieMessageIsError(true);
      return;
    }

    const id = selfieId || `country-selfie-${countryKey}`;
    setSelfieWorking(true);
    try {
      await saveLocalSelfie(id, file);
      const preview = URL.createObjectURL(file);
      setSelfiePreview((current) => {
        if (current.startsWith('blob:')) URL.revokeObjectURL(current);
        return preview;
      });
      setSelectedSelfie(file);
      setVisited(country, true);
      setSelfie(country, id, record?.selfieCloudPath);
      setSelfieMessage(t('selfieLocalSaved'));
      setSelfieMessageIsError(false);
    } catch (error) {
      setSelfieMessage(error instanceof Error ? error.message : t('selfieLocalError'));
      setSelfieMessageIsError(true);
    } finally {
      setSelfieWorking(false);
    }
  };

  const uploadSelfie = async () => {
    if (!country) return;
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      setSelfieMessage(t('firebaseNotConfigured'));
      setSelfieMessageIsError(true);
      return;
    }
    setSelfieWorking(true);
    setSelfieMessage('');
    try {
      let user = auth.currentUser;
      if (!user) {
        await signInWithPopup(auth, googleProvider);
        user = auth.currentUser;
      }
      if (!user) {
        setSelfieMessage(t('selfieUploadNeedsSignIn'));
        setSelfieMessageIsError(true);
        return;
      }
      const image = selectedSelfie || (selfieId ? await loadLocalSelfie(selfieId) : undefined);
      if (!image) {
        setSelfieMessage(t('selfieLocalError'));
        setSelfieMessageIsError(true);
        return;
      }
      const imageBase64 = await fileToBase64(image);
      const response = await fetch('/api/sync/selfie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          countryCode: country.cca3 || country.name.common.toLowerCase(),
          countryName: country.name.common,
          flag: country.flag,
          mimeType: image.type,
          imageBase64,
        }),
      });
      const result = (await response.json()) as { error?: string; selfieName?: string; url?: string };
      if (!response.ok) {
        if (response.status === 403) {
          setSelfieMessage(t('selfieSubscriptionRequired'));
        } else if (response.status === 413) {
          setSelfieMessage(t('selfieFileSizeError'));
        } else {
          throw new Error(result.error || t('selfieUploadError'));
        }
        setSelfieMessageIsError(true);
        return;
      }
      setSelfie(country, selfieId || `country-selfie-${countryKey}`, result.selfieName);
      if (result.url) setSelfiePreview(result.url);
      setSelectedSelfie(null);
      setSelfieMessage(t('selfieUploadSuccess'));
      setSelfieMessageIsError(false);
    } catch (error) {
      setSelfieMessage(error instanceof Error ? error.message : t('selfieUploadError'));
      setSelfieMessageIsError(true);
    } finally {
      setSelfieWorking(false);
    }
  };

  const deleteSelfie = async () => {
    if (!country || !window.confirm(t('selfieDeleteConfirm'))) return;
    const existingId = selfieId || `country-selfie-${countryKey}`;
    setSelfieWorking(true);
    setSelfieMessage('');
    let cloudDeleteFailed = false;
    try {
      await removeLocalSelfie(existingId);
      setSelectedSelfie(null);
      setSelfiePreview((current) => {
        if (current.startsWith('blob:')) URL.revokeObjectURL(current);
        return '';
      });
      if (record?.selfieCloudPath && auth.currentUser) {
        const params = new URLSearchParams({
          countryCode: country.cca3 || country.name.common.toLowerCase(),
          countryName: country.name.common,
        });
        const response = await fetch(`/api/sync/selfie?${params}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
        });
        cloudDeleteFailed = !response.ok;
      } else if (record?.selfieCloudPath) {
        cloudDeleteFailed = true;
      }
      clearSelfie(country, cloudDeleteFailed);
      setSelfieMessage(cloudDeleteFailed ? t('selfieCloudDeleteError') : t('selfieDeleted'));
      setSelfieMessageIsError(cloudDeleteFailed);
    } catch (error) {
      setSelfieMessage(error instanceof Error ? error.message : t('selfieLocalError'));
      setSelfieMessageIsError(true);
    } finally {
      setSelfieWorking(false);
    }
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

            <section className={styles.selfieSection}>
              <div className={styles.cityHeading}>
                <div>
                  <h2>{t('selfie')}</h2>
                  <p>{t('selfieTypes')}</p>
                </div>
              </div>
              {selfiePreview && (
                <Image
                  src={selfiePreview}
                  alt={t('selfiePreview').replace('{country}', displayName)}
                  width={720}
                  height={540}
                  unoptimized
                  className={styles.selfiePreview}
                />
              )}
              <div className={styles.selfieControls}>
                <label className={styles.primaryAction}>
                  {selfiePreview ? t('replaceSelfie') : t('addSelfie')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={chooseSelfie}
                    disabled={!ready || selfieWorking || Boolean(storageError)}
                    aria-label={selfiePreview ? t('replaceSelfie') : t('addSelfie')}
                  />
                </label>
                {selfiePreview && (!record?.selfieCloudPath || selectedSelfie) && (
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => void uploadSelfie()}
                    disabled={selfieWorking || Boolean(storageError) || !ready}
                  >
                    {selfieWorking ? t('selfieUploading') : t('uploadSelfie')}
                  </button>
                )}
                {selfiePreview && (
                  <button
                    type="button"
                    className={styles.dangerAction}
                    onClick={() => void deleteSelfie()}
                    disabled={selfieWorking || Boolean(storageError)}
                  >
                    {t('deleteSelfie')}
                  </button>
                )}
                {selfieWorking && <span role="status">{t('selfieUploading')}</span>}
              </div>
              {selfiePreview && (
                <p className={styles.selfieStatus}>
                  {record?.selfieCloudPath && !selectedSelfie
                    ? t('selfieCloudSaved')
                    : t('selfieLocalSaved')}
                </p>
              )}
              {selfieMessage && (
                <p
                  className={selfieMessageIsError ? styles.errorBanner : styles.selfieStatus}
                  role={selfieMessageIsError ? 'alert' : 'status'}
                >
                  {selfieMessage}
                </p>
              )}
            </section>

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
