import PolicyPage from '@/components/PolicyPage';
import styles from '@/styles/PolicyPage.module.css';

export default function PrivacyPolicy() {
  return (
    <PolicyPage title="Privacy Policy">
      <section className={styles.section}>
        <h2>1. Information this Service handles</h2>
        <p>
          The Travelling mobile application may handle account details
          supplied by your sign-in provider, such as your account identifier,
          name, email address, and profile image. It also stores the travel
          information you choose to add, including visited countries, cities,
          notes, and photos.
        </p>
        <p>
          If you enable profile visibility, your name, profile image, and
          visited-country count may be shown to other Travelling users. You
          can turn visibility off in the app.
        </p>
        <p>
          The Travelling website currently displays country information
          obtained from the REST Countries service. The website itself does
          not offer account registration or accept travel entries.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. How information is used</h2>
        <ul>
          <li>To authenticate your account and provide the Service.</li>
          <li>To save and sync your travel records and photos.</li>
          <li>To display profiles you have chosen to make visible.</li>
          <li>To maintain, secure, and improve the Service.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>3. Service providers</h2>
        <p>
          The mobile app uses Google Firebase services for authentication,
          database storage, and photo storage. Google and Facebook may process
          information when you choose their sign-in options, under their own
          privacy policies. The website requests country information from REST
          Countries. These providers process information under their own terms
          and privacy practices.
        </p>
        <p>
          We do not sell your personal information. We may disclose information
          when required by law or when reasonably necessary to protect users,
          the Service, or another person’s rights.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Storage and retention</h2>
        <p>
          Your information is stored by the service providers described above
          while needed to provide the Service. If you want your account and
          associated information deleted, contact us using the address below.
          Some records may remain for a limited period where needed to meet
          legal obligations or resolve disputes.
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. Your choices</h2>
        <p>
          You choose what travel details and photos to add, and whether your
          profile is visible to other users. You may request access to,
          correction of, or deletion of your personal information by
          contacting us. We will handle requests as required by applicable
          law.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Children</h2>
        <p>
          The Service is not directed to children under 13, and we do not
          knowingly collect personal information from children under 13. If
          you believe a child has provided us personal information, contact us
          so we can review and delete it where appropriate.
        </p>
      </section>

      <section className={styles.section}>
        <h2>7. Changes to this policy</h2>
        <p>
          We may update this policy when the Service or its data practices
          change. The updated date at the top of this page shows when the
          current version took effect.
        </p>
      </section>

      <section className={styles.section}>
        <h2>8. Contact</h2>
        <p>
          For privacy questions or requests, email{' '}
          <a href="mailto:dmitriy.turskyi@gmail.com">
            dmitriy.turskiy@gmail.com
          </a>
          .
        </p>
      </section>
    </PolicyPage>
  );
}
