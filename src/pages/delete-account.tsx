import { useState, useEffect } from 'react';
import PolicyPage from '@/components/PolicyPage';
import styles from '@/styles/PolicyPage.module.css';
import {
  auth,
  getRedirectResult,
  googleProvider,
  signInWithRedirect,
  signOut,
} from '@/lib/firebaseClient';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function DeleteAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    void getRedirectResult(auth).catch((err: unknown) => {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Google sign-in failed');
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setStatus('loading');
      setMessage('');
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setStatus('error');
      setMessage('Please sign in with Google first.');
      return;
    }
    if (!confirmed) {
      setStatus('error');
      setMessage('Please check the confirmation box to proceed with permanent deletion.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const token = await user.getIdToken(true);
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(
          data.message ||
            'Your account and associated cloud data have been permanently deleted.'
        );
        await signOut(auth);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to delete account. Please try again.');
      }
    } catch (_err) {
      setStatus('error');
      setMessage('An unexpected error occurred while requesting account deletion.');
    }
  };

  return (
    <PolicyPage title="Delete Travelling Account & Cloud Data">
      <section className={styles.section}>
        <h2>Account Deletion Request</h2>
        <p>
          You can request permanent deletion of your Travelling account, cloud backup
          records, visited countries/cities data, and uploaded selfie photos across Travelling apps.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What gets deleted?</h2>
        <ul>
          <li>Your cloud backup records (visited countries and cities).</li>
          <li>Your uploaded selfie photos stored in Cloud Storage (including Pro photos).</li>
          <li>Your subscription entitlement state and sync preferences.</li>
          <li>Your Firebase authentication profile and user account record.</li>
        </ul>
        <p>
          <strong>Note:</strong> Deleting your cloud account does NOT delete your local
          data stored on your device, nor does it automatically cancel active Google Play
          subscriptions. You must manage or cancel active subscriptions in the{' '}
          <a
            href="https://play.google.com/store/account/subscriptions"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Play Subscription Center
          </a>
          .
        </p>
      </section>

      <section className={styles.section}>
        <h2>Account Deletion Flow</h2>
        {!user ? (
          <div style={{ marginTop: '1rem' }}>
            <p>Sign in with Google to verify your account ownership before deletion:</p>
            <button
              onClick={handleGoogleSignIn}
              style={{
                backgroundColor: '#4285F4',
                color: '#fff',
                padding: '0.6rem 1.2rem',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <form onSubmit={handleDelete} style={{ maxWidth: '500px', marginTop: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <p>
                Signed in as: <strong>{user.email || user.displayName}</strong>
              </p>
              <button
                type="button"
                onClick={() => signOut(auth)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0070f3',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Sign out / Switch account
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  style={{ marginRight: '0.5rem', width: '18px', height: '18px' }}
                  required
                />
                <span>I understand that this action is permanent and cannot be undone.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={status === 'loading' || !confirmed}
              style={{
                backgroundColor: '#d9534f',
                color: '#fff',
                padding: '0.6rem 1.2rem',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: confirmed ? 'pointer' : 'not-allowed',
                opacity: confirmed ? 1 : 0.6,
              }}
            >
              {status === 'loading' ? 'Deleting...' : 'Permanently Delete Account & Cloud Data'}
            </button>
          </form>
        )}

        {message && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              borderRadius: '4px',
              backgroundColor: status === 'success' ? '#d4edda' : '#f8d7da',
              color: status === 'success' ? '#155724' : '#721c24',
            }}
          >
            {message}
          </div>
        )}
      </section>
    </PolicyPage>
  );
}
