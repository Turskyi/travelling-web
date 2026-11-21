import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import { isAdminUser } from '@/lib/adminAuth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const decodedToken = await verifyAuthToken(req);
    const uid = decodedToken.uid;
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();

    const isAdmin = isAdminUser(decodedToken);

    // Check entitlement or staged migration permission
    const entitlementDoc = await db.collection('entitlements').doc(uid).get();
    const entitlement = entitlementDoc.data();
    const now = Date.now();

    // Temporary free access flag: defaults to true unless FREE_ACCESS_FOR_ALL is explicitly set to "false" on Vercel
    const freeAccessForall = process.env.FREE_ACCESS_FOR_ALL !== 'false';
    const isEntitled =
      freeAccessForall ||
      isAdmin ||
      (entitlement?.active === true && (entitlement.expiryTimeMs || 0) > now);

    const userRef = db.collection('users').doc(uid);
    const isStaged =
      isAdmin || (await userRef.collection('visited_countries').get()).size > 0;

    if (!isEntitled && !isStaged) {
      return res.status(403).json({
        error: 'Active subscription or migration authorization required.',
      });
    }

    if (req.method === 'GET') {
      const countriesSnap = await userRef.collection('visited_countries').get();
      const citiesSnap = await userRef.collection('cities').get();

      const countries = countriesSnap.docs.map((doc) => doc.data());
      const cities = citiesSnap.docs.map((doc) => doc.data());

      return res.status(200).json({ countries, cities });
    }

    if (req.method === 'POST') {
      const { countries = [], cities = [] } = req.body;

      if (!Array.isArray(countries) || !Array.isArray(cities)) {
        return res.status(400).json({
          error: 'Invalid payload shape: countries and cities must be arrays.',
        });
      }

      if (countries.length > 500 || cities.length > 5000) {
        return res.status(400).json({ error: 'Batch limit exceeded.' });
      }

      const batch = db.batch();

      // 1. Update user profile document with counter and metadata for social network
      const visitedCount = countries.filter(
        (c) => c.isVisited !== false,
      ).length;
      batch.set(
        userRef,
        {
          id: uid,
          name: decodedToken.name || decodedToken.email || 'Traveller',
          avatar: decodedToken.picture || '',
          counter: visitedCount,
          isVisible: true,
          updatedAt: now,
        },
        { merge: true },
      );

      // 2. Write to users/{uid}/visited_countries (deduplicated by normalized country name as doc ID)
      countries.forEach((country: any) => {
        const countryName = country.name || country.title;
        if (!countryName) return;
        const docId = String(countryName)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_');
        const userCountryRef = userRef
          .collection('visited_countries')
          .doc(docId);

        const countryData = {
          id: Number(country.id) || 0,
          title: countryName,
          shortName: country.shortName || countryName,
          flag: country.flag || '',
          isVisited: country.isVisited !== false,
          selfie: country.selfie || '',
          updatedAt: now,
        };

        batch.set(userCountryRef, countryData, { merge: true });
      });

      // 3. Write to users/{uid}/cities (with id and parentId as Numbers for TravellingPro CityEntity compatibility)
      cities.forEach((city: any) => {
        if (!city.id) return;
        const cityId = String(city.id);
        const userCityRef = userRef.collection('cities').doc(cityId);

        const cityData = {
          ...city,
          id: Number(city.id) || 0,
          parentId: Number(city.parentId) || 0,
          updatedAt: now,
        };

        batch.set(userCityRef, cityData, { merge: true });
      });

      await batch.commit();

      const updatedCountriesSnap = await userRef
        .collection('visited_countries')
        .get();
      const updatedCitiesSnap = await userRef.collection('cities').get();

      // Count uploaded selfies in storage for verification count
      let serverSelfieCount = 0;
      try {
        const bucket = adminApp.storage().bucket();
        const [files] = await bucket.getFiles({
          prefix: `cloud_sync/selfies/${uid}/`,
        });
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
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';
    console.error('API /api/sync/data error:', error);
    const status = message.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
