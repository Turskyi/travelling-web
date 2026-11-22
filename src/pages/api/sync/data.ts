import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import { isAdminUser } from '@/lib/adminAuth';
import { getSelfieObjectPath } from '@/lib/selfieObjectPath';

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

    // Temporary free access must be explicitly enabled; subscriptions are otherwise required.
    const freeAccessForall = process.env.FREE_ACCESS_FOR_ALL === 'true';
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

      // 0. Delete countries in Firestore that were removed locally
      const existingCountriesSnap = await userRef
        .collection('visited_countries')
        .get();
      const incomingCountryIds = new Set(
        countries
          .map((c: any) =>
            String(c.name || c.title || '')
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '_'),
          )
          .filter(Boolean),
      );

      existingCountriesSnap.docs.forEach((doc) => {
        if (!incomingCountryIds.has(doc.id)) {
          batch.delete(doc.ref);
        }
      });

      // 1. Update user profile document with counter and metadata for social network
      const userDocSnap = await userRef.get();
      const existingData = userDocSnap.data();
      const currentIsVisible =
        typeof existingData?.isVisible === 'boolean'
          ? existingData.isVisible
          : true;
      const currentVisibility = existingData?.visibility || 'everyone';
      const currentShareCode = existingData?.shareCode || String(uid.slice(0, 8)).toUpperCase();

      const visitedCount = countries.filter(
        (c) => c.isVisited !== false,
      ).length;

      const rawName =
        existingData?.displayName ||
        existingData?.name ||
        decodedToken.name ||
        (decodedToken.email ? decodedToken.email.split('@')[0] : 'Traveller');

      batch.set(
        userRef,
        {
          id: uid,
          displayName: rawName,
          name: rawName,
          avatar: decodedToken.picture || existingData?.avatar || '',
          counter: visitedCount,
          visitedCountryCount: visitedCount,
          isVisible: currentIsVisible,
          visibility: currentVisibility,
          shareCode: currentShareCode,
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

        const countryData: Record<string, unknown> = {
          id: Number(country.id) || 0,
          title: countryName,
          shortName: country.shortName || countryName,
          flag: country.flag || '',
          isVisited: country.isVisited !== false,
          updatedAt: now,
        };
        if (typeof country.countryCode === 'string') {
          countryData.countryCode = country.countryCode;
        }
        if (typeof country.visitedAt === 'string') {
          countryData.visitedAt = country.visitedAt;
        }
        if (typeof country.selfie === 'string' && country.selfie) {
          countryData.selfie = country.selfie;
        }

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

      const bucketName = adminApp.storage().bucket().name;
      const serverSelfieCount = updatedCountriesSnap.docs.filter((doc) =>
        Boolean(getSelfieObjectPath(doc.data(), bucketName)),
      ).length;

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
