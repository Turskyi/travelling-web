import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import useAppLanguage from '@/hooks/useAppLanguage';
import { auth, browserLocalPersistence, googleProvider, setPersistence, signInWithRedirect } from '@/lib/firebaseClient';
import type { PublicTravellerSummary } from '@/lib/travellerPrivacy';
import styles from '@/styles/Travellers.module.css';

interface TravellersData {
  travellers: PublicTravellerSummary[];
  topPercent?: number;
  currentUserIsVisible?: boolean;
}

export default function TravellersPage() {
  const { language, t } = useAppLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [travellers, setTravellers] = useState<PublicTravellerSummary[]>([]);
  const [topPercent, setTopPercent] = useState<number | undefined>(undefined);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  // Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch travellers list and user visibility
  const loadTravellers = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      let headers: Record<string, string> = {};
      if (user) {
        try {
          const token = await user.getIdToken();
          headers = { Authorization: `Bearer ${token}` };
        } catch {
          // Token error - fallback to guest
        }
      }

      const queryUrl = searchQuery
        ? `/api/travellers?q=${encodeURIComponent(searchQuery)}`
        : '/api/travellers';

      const response = await fetch(queryUrl, { headers });
      if (!response.ok) {
        throw new Error(t('travellersLoadError'));
      }

      const data: TravellersData = await response.json();
      setTravellers(data.travellers || []);
      setTopPercent(data.topPercent);
      if (typeof data.currentUserIsVisible === 'boolean') {
        setIsVisible(data.currentUserIsVisible);
      }
      setStatus('idle');
    } catch (error) {
      console.error('Failed to load travellers:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('travellersLoadError'));
    }
  }, [searchQuery, t, user]);

  useEffect(() => {
    if (authReady) {
      void loadTravellers();
    }
  }, [authReady, loadTravellers]);

  const toggleVisibility = async (newVisibility: boolean) => {
    if (!user) return;
    setIsUpdatingVisibility(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/travellers/visibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isVisible: newVisibility }),
      });

      if (!res.ok) {
        throw new Error('Failed to update profile visibility.');
      }

      setIsVisible(newVisibility);
      setShowVisibilityModal(false);
      await loadTravellers();
    } catch (err) {
      console.error(err);
      alert('Could not update visibility. Please check your connection.');
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleToggleClick = () => {
    if (!user) return;
    if (!isVisible) {
      // User is turning visibility ON -> prompt with modal
      setShowVisibilityModal(true);
    } else {
      // User is turning visibility OFF -> update directly
      void toggleVisibility(false);
    }
  };

  const signIn = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      console.error('Sign-in error:', err);
    }
  };

  const locale = language === 'uk' ? 'uk-UA' : 'en-US';

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{t('appName').toUpperCase()}</span>
          <h1>{t('travellersTitle')}</h1>
          <p>{t('travellersSubtitle')}</p>
        </div>

        {typeof topPercent === 'number' && (
          <div className={styles.topBadge} aria-label={t('topTravellersPercent').replace('{percent}', String(topPercent))}>
            <span className={styles.topBadgeIcon} role="img" aria-hidden="true">🏆</span>
            <div className={styles.topBadgeText}>
              <strong>
                {topPercent > 0
                  ? t('topTravellersPercent').replace('{percent}', String(topPercent))
                  : t('mostTravelled')}
              </strong>
              <span>{t('appName')}</span>
            </div>
          </div>
        )}
      </header>

      <section className={styles.controlsBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon} aria-hidden="true">🔍</span>
          <input
            type="search"
            className={styles.searchInput}
            placeholder={t('searchTravellers')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('searchTravellers')}
          />
        </div>

        <div className={styles.visibilityToggleSection}>
          {user ? (
            <>
              <span
                className={`${styles.visibilityBadge} ${
                  isVisible ? styles.visibleBadge : styles.hiddenBadge
                }`}
              >
                {isVisible ? `👁️ ${t('profileVisible')}` : `🙈 ${t('profileHidden')}`}
              </span>
              <button
                type="button"
                className={`${styles.toggleBtn} ${
                  isVisible ? styles.toggleBtnSecondary : styles.toggleBtnPrimary
                }`}
                onClick={handleToggleClick}
                disabled={isUpdatingVisibility}
              >
                {isVisible ? t('hideProfile') : t('makeProfileVisible')}
              </button>
            </>
          ) : (
            <button type="button" className={`${styles.toggleBtn} ${styles.toggleBtnSecondary}`} onClick={signIn}>
              {t('signInToShareProfile')}
            </button>
          )}
        </div>
      </section>

      {status === 'loading' && (
        <div className={styles.loadingState}>
          <p>{t('loadingTravellers')}</p>
        </div>
      )}

      {status === 'error' && (
        <div className={styles.errorState} role="alert">
          <p>{errorMessage || t('travellersLoadError')}</p>
          <button type="button" className={styles.retryBtn} onClick={() => void loadTravellers()}>
            {t('retry')}
          </button>
        </div>
      )}

      {status === 'idle' && travellers.length === 0 && (
        <div className={styles.emptyState}>
          <p>{t('noTravellersFound')}</p>
        </div>
      )}

      {status === 'idle' && travellers.length > 0 && (
        <section className={styles.grid} aria-label={t('travellersTitle')}>
          {travellers.map((traveller) => (
            <Link
              key={traveller.id}
              href={`/travellers/${traveller.id}`}
              className={styles.card}
            >
              {traveller.avatar ? (
                // Profile pictures provided by Google or avatar URL
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={traveller.avatar}
                  alt=""
                  className={styles.avatar}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={styles.avatarFallback} aria-hidden="true">
                  {traveller.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={styles.cardInfo}>
                <span className={styles.cardName}>{traveller.name}</span>
                <span className={styles.cardCounter}>
                  {t('visitedCountriesCount').replace(
                    '{count}',
                    new Intl.NumberFormat(locale).format(traveller.counter),
                  )}
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* Confirmation Modal when becoming visible */}
      {showVisibilityModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className={styles.modalContent}>
            <h2 id="modal-title">{t('visibilityDialogTitle')}</h2>
            <p>{t('visibilityDialogText')}</p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${styles.toggleBtnSecondary}`}
                onClick={() => setShowVisibilityModal(false)}
                disabled={isUpdatingVisibility}
              >
                {t('cancelVisibility')}
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${styles.toggleBtnPrimary}`}
                onClick={() => void toggleVisibility(true)}
                disabled={isUpdatingVisibility}
              >
                {t('confirmBecomeVisible')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
