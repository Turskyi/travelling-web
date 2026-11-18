import Link from 'next/link';
import PolicyPage from '@/components/PolicyPage';
import styles from '@/styles/PolicyPage.module.css';

export default function PrivacyPolicy() {
  return (
    <PolicyPage title="Privacy Policy">
      <section className={styles.section}>
        <h2>1. Information this Service handles</h2>
        <p>
          The Travelling mobile application offers opt-in cloud backup and sync
          subscriptions. When you sign in with Google, we process your account
          identifier, name, email address, and profile photo. If you choose to
          enable cloud backup, the app uploads your visited travel data
          (visited countries, cities) and selfie photos to secure cloud storage
          (Google Firebase).
        </p>
        <p>
          If you subscribe to Travelling Cloud Sync, Google Play processes your
          purchase details and provides a purchase token to our server to
          verify active subscription entitlements.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. How information is used</h2>
        <ul>
          <li>To authenticate your account via Google Sign-In.</li>
          <li>To back up and synchronize your travel records and photos across devices.</li>
          <li>To verify Google Play subscription status and grant entitlement access.</li>
          <li>To maintain, secure, and operate the Service.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>3. Data Retention and Storage</h2>
        <p>
          Cloud backup data and photos are stored in Google Cloud / Firebase
          infrastructure under your account identifier (Firebase UID).
        </p>
        <ul>
          <li>
            <strong>Staged Migration Data:</strong> If cloud backup staging is initiated but abandoned before completing a subscription, staged cloud data is automatically deleted after 30 days.
          </li>
          <li>
            <strong>Active Subscriptions:</strong> Your cloud backup remains active while your subscription is valid.
          </li>
          <li>
            <strong>Subscription Expiry:</strong> When a subscription expires, cloud access is paused. Cloud backup data is retained for 30 days to allow resubscription, after which cloud records are permanently deleted. Local device data on your phone remains available.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>4. Account Deletion</h2>
        <p>
          You can request immediate deletion of your cloud account and all
          associated cloud travel records and photos at any time in the app
          or on our website at{' '}
          <Link href="/delete-account">Delete Account</Link>.
        </p>
        <p>
          Deleting your account removes all user-owned cloud records and
          authentication credentials across Travelling apps. Account deletion
          does not automatically cancel Google Play subscriptions; you must manage or
          cancel subscriptions in Google Play Store settings.
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. Service providers</h2>
        <p>
          The app uses Google Firebase services for authentication, Firestore
          database storage, and Cloud Storage for photos, as well as Google Play
          Developer APIs for subscription verification. These providers process
          information under their own terms and privacy practices.
        </p>
        <p>
          We do not sell your personal information.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Contact</h2>
        <p>
          For privacy questions or deletion requests, email{' '}
          <a href="mailto:dmitriy.turskyi@gmail.com">
            dmitriy.turskiy@gmail.com
          </a>
          .
        </p>
      </section>
    </PolicyPage>
  );
}
