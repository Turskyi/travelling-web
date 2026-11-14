import PolicyPage from '@/components/PolicyPage';
import styles from '@/styles/PolicyPage.module.css';

export default function TermsOfService() {
  return (
    <PolicyPage title="Terms of Service">
      <section className={styles.section}>
        <h2>1. About Travelling</h2>
        <p>
          Travelling is a service for keeping a personal record of countries
          you have visited, related travel notes, and optional photos. These
          terms apply to the Travelling mobile applications and the website at
          travelling.turskyi.com (together, the “Service”).
        </p>
        <p>
          By accessing or using the Service, you agree to these terms. If you
          do not agree, do not use the Service.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Your account</h2>
        <p>
          The mobile application lets you sign in using Google or Facebook.
          You are responsible for keeping access to your account secure and
          for activity performed through it. Information supplied by your
          identity provider is also subject to that provider’s terms and
          privacy practices.
        </p>
        <p>
          Please provide accurate information and let us know if you believe
          someone has used your account without permission.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Your content and use of the Service</h2>
        <p>
          You retain your rights to content you submit, such as travel details
          and photos. You give Travelling permission to store, reproduce, and
          display that content only as needed to operate and provide the
          Service, including showing profile information to other users when
          you enable visibility.
        </p>
        <p>
          Only submit content you have the right to use. Do not use the
          Service to break the law, infringe another person’s rights, upload
          harmful material, disrupt the Service, or attempt to access another
          user’s account or data.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Availability and changes</h2>
        <p>
          We may update, suspend, or discontinue parts of the Service to
          maintain or improve it. We aim to keep the Service available, but
          cannot guarantee uninterrupted or error-free operation. You should
          keep your own copies of information that you cannot afford to lose.
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. Disclaimers and liability</h2>
        <p>
          The Service is provided on an “as available” basis. To the extent
          permitted by applicable law, Travelling disclaims warranties that
          cannot be excluded by law and is not responsible for indirect,
          incidental, special, or consequential loss arising from use of the
          Service. Nothing in these terms limits rights or remedies that
          applicable law does not allow us to limit.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Changes to these terms</h2>
        <p>
          We may revise these terms as the Service changes. The updated date at
          the top of this page shows when the current version took effect.
          Continued use after a revision means you accept the revised terms.
        </p>
      </section>

      <section className={styles.section}>
        <h2>7. Contact</h2>
        <p>
          Questions about these terms? Email{' '}
          <a href="mailto:dmitriy.turskiy@gmail.com">
            dmitriy.turskiy@gmail.com
          </a>
          .
        </p>
      </section>
    </PolicyPage>
  );
}
