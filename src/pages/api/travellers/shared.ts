import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import { getSelfieObjectPath } from '@/lib/selfieObjectPath';
import { sanitizeShareCode, sanitizeVisibility } from './profile';

export interface SharedCityVisit {
  name: string;
  date: string;
  latitude?: number;
  longitude?: number;
}

export interface SharedCountryVisit {
  countryCode: string;
  countryName: string;
  flag: string;
  visited: boolean;
  visitedAt?: string;
  hasPhoto: boolean;
  cities: SharedCityVisit[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decodedToken = await verifyAuthToken(req);
    const viewerUid = decodedToken.uid;
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();
    const bucket = adminApp.storage().bucket();

    const targetCode = sanitizeShareCode(req.query.code);
    if (!targetCode) {
      return res.status(400).json({ error: 'A valid traveller code is required.' });
    }

    let targetDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    const userMatchSnap = await db.collection('users')
      .where('shareCode', '==', targetCode)
      .limit(1)
      .get();
    if (!userMatchSnap.empty) {
      targetDoc = userMatchSnap.docs[0];
    } else {
      const travellerMatchSnap = await db.collection('travellers')
        .where('shareCode', '==', targetCode)
        .limit(1)
        .get();
      if (!travellerMatchSnap.empty) {
        targetDoc = travellerMatchSnap.docs[0];
      }
    }

    if (!targetDoc) {
      return res.status(404).json({ error: 'No traveller was found with that code.' });
    }

    const targetUid = targetDoc.id;
    const data = targetDoc.data();
    const visibility = sanitizeVisibility(data.visibility);

    if (visibility === 'privateProfile') {
      return res.status(403).json({ error: "This traveller hasn't shared their list." });
    }

    if (visibility === 'friends') {
      const viewerUserDoc = await db.collection('users').doc(viewerUid).get();
      const viewerTravellerDoc = await db.collection('travellers').doc(viewerUid).get();
      const viewerData = viewerUserDoc.data() || viewerTravellerDoc.data() || {};
      const viewerShareCode = sanitizeShareCode(viewerData.shareCode) || String(viewerUid.slice(0, 8)).toUpperCase();

      const candidateFriendCodes = Array.isArray(data.friendCodes)
        ? data.friendCodes.map((c: unknown) => sanitizeShareCode(c))
        : [];

      if (!viewerShareCode || !candidateFriendCodes.includes(viewerShareCode)) {
        return res.status(403).json({
          error: 'This private traveller must add your code before sharing their list.',
        });
      }
    }

    const targetRef = db.collection('users').doc(targetUid);
    const countriesSnap = await targetRef.collection('visited_countries').get();
    const citiesSnap = await targetRef.collection('cities').get();

    const citiesByCountry = new Map<string, SharedCityVisit[]>();
    for (const cityDoc of citiesSnap.docs) {
      const cityData = cityDoc.data();
      const countryCode = String(cityData.countryCode || '').toUpperCase();
      const cityName = String(cityData.name || '').trim();
      if (!cityName) continue;

      const dateVal = cityData.date || cityData.month || cityData.updatedAt;
      const isoDate = dateVal
        ? (typeof dateVal === 'number' ? new Date(dateVal).toISOString() : String(dateVal))
        : new Date().toISOString();

      const item: SharedCityVisit = {
        name: cityName,
        date: isoDate,
      };
      if (typeof cityData.latitude === 'number') item.latitude = cityData.latitude;
      if (typeof cityData.longitude === 'number') item.longitude = cityData.longitude;

      if (!citiesByCountry.has(countryCode)) {
        citiesByCountry.set(countryCode, []);
      }
      citiesByCountry.get(countryCode)!.push(item);
    }

    const bucketName = bucket.name;
    const countryVisits: SharedCountryVisit[] = [];

    for (const countryDoc of countriesSnap.docs) {
      const cData = countryDoc.data();
      const isVisited = cData.isVisited !== false;
      if (!isVisited) continue;

      const countryName = String(cData.title || cData.name || cData.shortName || countryDoc.id).trim();
      const countryCode = String(cData.countryCode || '').toUpperCase();
      const flag = String(cData.flag || '');

      const visitedAtVal = cData.visitedAt || cData.updatedAt;
      const visitedAt = visitedAtVal
        ? (typeof visitedAtVal === 'number' ? new Date(visitedAtVal).toISOString() : String(visitedAtVal))
        : undefined;

      const selfiePath = getSelfieObjectPath(cData, bucketName);
      const hasPhoto = Boolean(selfiePath || cData.selfie || cData.selfieName);

      const matchedCities = (countryCode ? citiesByCountry.get(countryCode) : undefined) || [];

      countryVisits.push({
        countryCode,
        countryName,
        flag,
        visited: true,
        visitedAt,
        hasPhoto,
        cities: matchedCities,
      });
    }

    countryVisits.sort((a, b) => a.countryName.localeCompare(b.countryName));

    const displayName = String(data.displayName || data.name || 'Traveller').trim();

    return res.status(200).json({
      id: targetUid,
      displayName,
      shareCode: targetCode,
      countries: countryVisits,
    });
  } catch (error) {
    console.error('API /api/travellers/shared error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
