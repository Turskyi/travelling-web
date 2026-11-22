import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import useSWR from 'swr';
import useAppLanguage from '@/hooks/useAppLanguage';
import useTravelTracker from '@/hooks/useTravelTracker';
import {
  auth,
  browserLocalPersistence,
  getRedirectResult,
  googleProvider,
  setPersistence,
  signInWithRedirect,
  signOut,
} from '@/lib/firebaseClient';
import type { Country } from '@/models/Country';
import type { TravelHistory, TravelRecord } from '@/models/TravelRecord';
import * as CountryApi from '@/network/country-api';
import styles from '@/styles/Account.module.css';

interface SubscriptionStatus {
  active: boolean;
  expiryTimeMs: number;
  state: string;
  hasBackup: boolean;
  backupStatus: string;
}

interface CloudCountry {
  id?: number;
  title?: string;
  name?: string;
  flag?: string;
  isVisited?: boolean;
  updatedAt?: number;
  selfie?: string;
}

interface CloudCity {
  id?: number;
  parentId?: number;
  name?: string;
  month?: string;
}

interface CloudBackup {
  countries: CloudCountry[];
  cities: CloudCity[];
}

interface CloudPayload {
  countries?: CloudCountry[];
  cities?: CloudCity[];
  serverCountryCount?: number;
  serverCityCount?: number;
  success?: boolean;
}

const SIGN_IN_PENDING_KEY = 'travelling.googleSignInPending';

class AccountApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function requestApi<T>(
  path: string,
  user: User,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      result && typeof result === 'object' && 'error' in result &&
      typeof result.error === 'string'
        ? result.error
        : 'Request failed.';
    throw new AccountApiError(message, response.status);
  }
  return result as T;
}

function normalize(value: string) {
  return value.trim().normalize('NFKC').toLocaleLowerCase();
}

function localSignature(history: TravelHistory) {
  const entries = Object.values(history)
    .filter((record) => record.isVisited || record.cities.length > 0)
    .map((record) => ({
      name: normalize(record.countryName),
      visited: record.isVisited,
      cities: record.cities
        .map((city) => `${normalize(city.name)}|${city.month}`)
        .sort(),
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
  return JSON.stringify(entries);
}

function cloudSignature(backup: CloudBackup) {
  const countriesById = new Map<number, string>();
  const entries = new Map<string, { name: string; visited: boolean; cities: string[] }>();
  for (const country of backup.countries) {
    const name = country.title || country.name || '';
    if (!name) continue;
    if (typeof country.id === 'number') countriesById.set(country.id, normalize(name));
    entries.set(normalize(name), {
      name: normalize(name),
      visited: country.isVisited !== false,
      cities: [],
    });
  }
  for (const city of backup.cities) {
    if (typeof city.parentId !== 'number') continue;
    const parentName = countriesById.get(city.parentId);
    if (!parentName) continue;
    const entry = entries.get(parentName);
    if (entry) entry.cities.push(`${normalize(city.name || '')}|${city.month || ''}`);
  }
  return JSON.stringify(
    Array.from(entries.values())
      .filter((entry) => entry.visited || entry.cities.length > 0)
      .map((entry) => ({ ...entry, cities: entry.cities.sort() }))
      .sort((first, second) => first.name.localeCompare(second.name)),
  );
}

export default function AccountPage() {
  const { language, t } = useAppLanguage();
  const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const { data: countries } = useSWR<Country[]>('all-countries', CountryApi.getCountries);
  const { history, ready, storageError, replaceHistory } = useTravelTracker();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [cloudBackup, setCloudBackup] = useState<CloudBackup | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        window.sessionStorage.removeItem(SIGN_IN_PENDING_KEY);
        setStatus((current) => current === 'loading' ? 'idle' : current);
        setMessage('');
      }
    }, (error) => {
      setAuthReady(true);
      setStatus('error');
      setMessage(error.message || t('accountSignInError'));
    });
    void getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          window.sessionStorage.removeItem(SIGN_IN_PENDING_KEY);
          setUser(result.user);
          setAuthReady(true);
          setStatus('idle');
          setMessage('');
        } else if (
          window.sessionStorage.getItem(SIGN_IN_PENDING_KEY) &&
          !auth.currentUser
        ) {
          window.sessionStorage.removeItem(SIGN_IN_PENDING_KEY);
          setStatus('error');
          setMessage(t('redirectSignInIncomplete'));
        }
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : t('accountSignInError'));
      });
    return () => unsubscribe();
  }, [t]);

  const loadCloudState = useCallback(async () => {
    if (!user) return;
    setStatus('loading');
    setMessage('');
    try {
      const currentSubscription = await requestApi<SubscriptionStatus>(
        '/api/subscription/status',
        user,
      );
      setSubscription(currentSubscription);
      if (currentSubscription.active || currentSubscription.hasBackup) {
        try {
          const backup = await requestApi<CloudBackup>('/api/sync/data', user);
          setCloudBackup({
            countries: Array.isArray(backup.countries) ? backup.countries : [],
            cities: Array.isArray(backup.cities) ? backup.cities : [],
          });
        } catch (error) {
          if (error instanceof AccountApiError && error.status === 403) {
            setCloudBackup(null);
          } else {
            throw error;
          }
        }
      } else {
        setCloudBackup(null);
      }
      setStatus('idle');
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : t('cloudUnavailable'),
      );
    }
  }, [t, user]);

  useEffect(() => {
    if (user) void loadCloudState();
    else {
      setSubscription(null);
      setCloudBackup(null);
      setStatus('idle');
    }
  }, [loadCloudState, user]);

  const localRecords = Object.values(history).filter(
    (record) => record.isVisited || record.cities.length > 0,
  );
  const localCityCount = localRecords.reduce(
    (count, record) => count + record.cities.length,
    0,
  );
  const cloudCityCount = cloudBackup?.cities.length || 0;
  const hasLocalData = localRecords.length > 0;
  const hasCloudData = Boolean(
    cloudBackup && (cloudBackup.countries.length > 0 || cloudBackup.cities.length > 0),
  );
  const hasConflict = Boolean(
    hasLocalData &&
      hasCloudData &&
      cloudBackup &&
      localSignature(history) !== cloudSignature(cloudBackup),
  );

  const signIn = async () => {
    if (!firebaseConfigured) {
      setStatus('error');
      setMessage(t('firebaseNotConfigured'));
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      await setPersistence(auth, browserLocalPersistence);
      window.sessionStorage.setItem(SIGN_IN_PENDING_KEY, '1');
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      window.sessionStorage.removeItem(SIGN_IN_PENDING_KEY);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t('accountSignInError'));
    }
  };

  const signOutCurrentUser = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t('cloudUnavailable'));
    }
  };

  const authorizeMigration = async () => {
    if (!user) return;
    setStatus('loading');
    setMessage('');
    try {
      await requestApi<{ allowed: boolean }>('/api/sync/authorize-migration', user, 'POST', {});
      setMessage(t('migrationReady'));
      setStatus('success');
      await loadCloudState();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t('cloudUnavailable'));
    }
  };

  const backUpLocalHistory = async () => {
    if (!user || !subscription?.active) return;
    setStatus('loading');
    setMessage('');
    try {
      const sortedRecords = [...localRecords].sort((a, b) =>
        a.countryCode.localeCompare(b.countryCode),
      );
      const countryIdByCode = new Map(
        sortedRecords.map((record, index) => [record.countryCode, index + 1]),
      );
      let cityId = 0;
      const payload = {
        countries: sortedRecords.map((record, index) => ({
          id: index + 1,
          name: record.countryName,
          shortName: record.countryName,
          flag: record.flag,
          isVisited: record.isVisited,
          selfie: '',
        })),
        cities: sortedRecords.flatMap((record) =>
          record.cities.map((city) => ({
            id: ++cityId,
            name: city.name,
            month: city.month,
            parentId: countryIdByCode.get(record.countryCode) || 0,
          })),
        ),
      };
      const result = await requestApi<CloudPayload>('/api/sync/data', user, 'POST', payload);
      setCloudBackup({
        countries: Array.isArray(result.countries) ? result.countries : [],
        cities: Array.isArray(result.cities) ? result.cities : [],
      });
      setMessage(t('backupSuccess'));
      setStatus('success');
      await loadCloudState();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t('cloudUnavailable'));
    }
  };

  const restoreCloudHistory = () => {
    if (!cloudBackup || !countries) return;
    const byName = new Map<string, Country>();
    for (const country of countries) {
      byName.set(normalize(country.name.common), country);
      byName.set(normalize(country.name.official), country);
    }
    const matched = new Map<number, { country: Country; record: TravelRecord }>();
    let ignored = 0;
    for (const cloudCountry of cloudBackup.countries) {
      const name = cloudCountry.title || cloudCountry.name || '';
      const country = byName.get(normalize(name));
      if (!country) {
        ignored += 1;
        continue;
      }
      const code = country.cca3 || country.name.common.toLowerCase();
      const id = typeof cloudCountry.id === 'number' ? cloudCountry.id : matched.size + 1;
      matched.set(id, {
        country,
        record: {
          countryCode: code,
          countryName: country.name.common,
          flag: cloudCountry.flag || country.flags.svg || country.flags.png,
          isVisited: cloudCountry.isVisited !== false,
          cities: [],
          selfieCloudPath:
            typeof cloudCountry.selfie === 'string' &&
            cloudCountry.selfie.startsWith('cloud_sync/selfies/')
              ? cloudCountry.selfie
              : undefined,
        },
      });
    }
    for (const cloudCity of cloudBackup.cities) {
      const parent = typeof cloudCity.parentId === 'number'
        ? matched.get(cloudCity.parentId)
        : undefined;
      if (!parent) {
        ignored += 1;
        continue;
      }
      parent.record.cities.push({
        id: String(cloudCity.id || (globalThis.crypto?.randomUUID?.() ?? Date.now())),
        name: cloudCity.name || '',
        month: cloudCity.month || '',
      });
    }
    const restored: TravelHistory = {};
    for (const { record } of Array.from(matched.values())) {
      if (record.isVisited || record.cities.length > 0) restored[record.countryCode] = record;
    }
    if (Object.keys(restored).length === 0 && cloudBackup.countries.length > 0) {
      setStatus('error');
      setMessage(t('noRestoreCountries'));
      return;
    }
    replaceHistory(restored);
    setMessage(
      ignored > 0
        ? `${t('restoreSuccess')} ${t('skippedRecords').replace('{count}', String(ignored))}`
        : t('restoreSuccess'),
    );
    setStatus('success');
  };

  const backupUpdated = useMemo(() => {
    const value = cloudBackup?.countries.reduce(
      (latest, country) => Math.max(latest, Number(country.updatedAt) || 0),
      0,
    );
    const locale = language === 'uk' ? 'uk-UA' : 'en-US';
    return value
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
      : '';
  }, [cloudBackup, language]);

  const isWorking = status === 'loading';

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <span>{t('appName').toLocaleUpperCase(language === 'uk' ? 'uk-UA' : 'en-US')}</span>
        <h1>{t('accountTitle')}</h1>
        <p>{t('accountDescription')}</p>
      </header>

      <section className={styles.card}>
        {!authReady ? (
          <p>{t('syncing')}</p>
        ) : !user ? (
          <>
            <p>{t('signInRequired')}</p>
            <button type="button" className={styles.primary} onClick={signIn} disabled={isWorking}>
              {t('signInGoogle')}
            </button>
          </>
        ) : (
          <>
            <div className={styles.accountRow}>
              <div>
                {user.photoURL ? (
                  // Google-hosted profile images are provided directly by Firebase Auth.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.avatar} src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className={styles.avatarFallback} aria-hidden="true">
                    {(user.displayName || user.email || '?').trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className={styles.accountIdentity}>
                <span>{t('signedInAs')}</span>
                <strong>{user.displayName || user.email || user.uid}</strong>
              </div>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void signOutCurrentUser()}
                disabled={isWorking}
              >
                {t('signOut')}
              </button>
            </div>

            <div className={styles.statusGrid}>
              <div>
                <span>{t('subscription')}</span>
                <strong className={subscription?.active ? styles.good : styles.neutral}>
                  {subscription?.active ? t('subscriptionActive') : t('subscriptionInactive')}
                </strong>
                <p>{t('subscriptionDetails')}</p>
                {subscription && subscription.expiryTimeMs > 0 && (
                  <small>
                    {new Intl.DateTimeFormat(language === 'uk' ? 'uk-UA' : 'en-US', { dateStyle: 'medium' }).format(
                      subscription.expiryTimeMs,
                    )}
                  </small>
                )}
              </div>
              <div>
                <span>{t('cloudStatus')}</span>
                <strong>{subscription?.backupStatus || 'NONE'}</strong>
                {backupUpdated && <small>{backupUpdated}</small>}
                <p>{hasCloudData ? t('cloudCount') : t('noCloudBackup')}</p>
              </div>
            </div>
            <a
              className={styles.textLink}
              href="https://play.google.com/store/account/subscriptions"
              target="_blank"
              rel="noreferrer"
            >
              {t('manageSubscription')} ↗
            </a>
          </>
        )}
      </section>

      {user && (
        <section className={styles.card}>
          <h2>{t('cloudStatus')}</h2>
          {storageError && <p className={styles.error} role="alert">{t('storageError')}</p>}
          <div className={styles.countGrid}>
            <div>
              <span>{t('localCount')}</span>
              <strong>{localRecords.length} / {localCityCount}</strong>
            </div>
            <div>
              <span>{t('cloudCount')}</span>
              <strong>{cloudBackup?.countries.length || 0} / {cloudCityCount}</strong>
            </div>
          </div>
          {hasConflict && <p className={styles.warning} role="alert">{t('conflictWarning')}</p>}
          {subscription?.backupStatus === 'STAGED' && (
            <p className={styles.notice}>{t('migrationReady')}</p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void backUpLocalHistory()}
              disabled={isWorking || !ready || Boolean(storageError) || !subscription?.active || !hasLocalData}
            >
              {t('backupLocal')}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={restoreCloudHistory}
              disabled={isWorking || !ready || Boolean(storageError) || !cloudBackup || !countries}
            >
              {t('restoreCloud')}
            </button>
            {!subscription?.active && (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void authorizeMigration()}
                disabled={isWorking}
              >
                {t('authorizeMigration')}
              </button>
            )}
          </div>
        </section>
      )}

      {status === 'loading' && <p className={styles.status}>{t('syncing')}</p>}
      {message && (
        <p className={status === 'error' ? styles.error : styles.success} role="status">
          {message}
        </p>
      )}
      <p className={styles.localNotice}>{t('localDataNote')}</p>
      <Link href="/delete-account" className={styles.deleteLink}>{t('deleteAccount')}</Link>
    </div>
  );
}
