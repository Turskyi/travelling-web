import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const decodedToken = await verifyAuthToken(req);
    const uid = decodedToken.uid;
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();

    // Check entitlement or staged migration permission
    const entitlementDoc = await db.collection('entitlements').doc(uid).get();
    const entitlement = entitlementDoc.data();
    const now = Date.now();
    const isEntitled = entitlement?.active === true && (entitlement.expiryTimeMs || 0) > now;

    const backupDoc = await db.collection('user_backups').doc(uid).get();
    const isStaged = backupDoc.exists && backupDoc.data()?.status === 'STAGED';

    if (!isEntitled && !isStaged) {
      return res.status(403).json({
        error: 'Active subscription or staged migration authorization required.',
      });
    }

    const backupRef = db.collection('user_backups').doc(uid);

    if (req.method === 'GET') {
      const countriesSnap = await backupRef.collection('countries').get();
      const citiesSnap = await backupRef.collection('cities').get();

      const countries = countriesSnap.docs.map((doc) => doc.data());
      const cities = citiesSnap.docs.map((doc) => doc.data());

      return res.status(200).json({ countries, cities });
    }

    if (req.method === 'POST') {
      const { countries = [], cities = [] } = req.body;

      if (!Array.isArray(countries) || !Array.isArray(cities)) {
        return res.status(400).json({ error: 'Invalid payload shape: countries and cities must be arrays.' });
      }

      if (countries.length > 500 || cities.length > 5000) {
        return res.status(400).json({ error: 'Batch limit exceeded.' });
      }

      const batch = db.batch();

      countries.forEach((country: any) => {
        if (!country.id) return;
        const countryRef = backupRef.collection('countries').doc(String(country.id));
        batch.set(
          countryRef,
          {
            ...country,
            updatedAt: now,
          },
          { merge: true }
        );
      });

      cities.forEach((city: any) => {
        if (!city.id) return;
        const cityRef = backupRef.collection('cities').doc(String(city.id));
        batch.set(
          cityRef,
          {
            ...city,
            updatedAt: now,
          },
          { merge: true }
        );
      });

      await batch.commit();

      const updatedCountriesSnap = await backupRef.collection('countries').get();
      const updatedCitiesSnap = await backupRef.collection('cities').get();

      // Count uploaded selfies in storage for verification count
      let serverSelfieCount = 0;
      try {
        const bucket = adminApp.storage().bucket();
        const [files] = await bucket.getFiles({ prefix: `cloud_sync/selfies/${uid}/` });
        serverSelfieCount = files.length;
      } catch (_e) {
        // Ignore storage count error
      }

      return res.status(200).json({
        success: true,
        serverCountryCount: updatedCountriesSnap.size,
        serverCityCount: updatedCitiesSnap.size,
        serverSelfieCount,
        countries: updatedCountriesSnap.docs.map((doc) => doc.data()),
        cities: updatedCitiesSnap.docs.map((doc) => doc.data()),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(500).json({ error: message });
  }
}
