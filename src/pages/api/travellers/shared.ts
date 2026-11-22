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
    console.log(`[API /api/travellers/shared] viewerUid=${viewerUid}, targetCode="${targetCode}"`);

    if (!targetCode) {
      return res.status(400).json({ error: 'A valid traveller code is required.' });
    }

    let targetDoc: FirebaseFirestore.DocumentSnapshot | undefined;

    const userMatchSnap = await db.collection('users')
      .where('shareCode', '==', targetCode)
      .limit(1)
      .get();
    if (!userMatchSnap.empty) {
      targetDoc = userMatchSnap.docs[0];
    } else {
      const allUsersSnap = await db.collection('users').limit(200).get();
      for (const doc of allUsersSnap.docs) {
        const docShareCode = sanitizeShareCode(doc.data().shareCode) || String(doc.id.slice(0, 8)).toUpperCase();
        if (docShareCode === targetCode) {
          targetDoc = doc;
          break;
        }
      }
    }

    if (!targetDoc || !targetDoc.exists) {
      console.log(`[API /api/travellers/shared] Traveller not found for code="${targetCode}"`);
      return res.status(404).json({ error: 'No traveller was found with that code.' });
    }

    const targetUid = targetDoc.id;
    const data = targetDoc.data() || {};
    const visibility = sanitizeVisibility(data.visibility);
    console.log(`[API /api/travellers/shared] Found targetUid=${targetUid}, visibility="${data.visibility}"`);

    if (visibility === 'privateProfile' && data.isVisible !== true) {
      return res.status(403).json({ error: "This traveller hasn't shared their list." });
    }

    if (visibility === 'friends') {
      const viewerUserDoc = await db.collection('users').doc(viewerUid).get();
      const viewerData = viewerUserDoc.data() || {};
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
    console.log(`[API /api/travellers/shared] Fetched ${countriesSnap.size} countries and ${citiesSnap.size} cities for targetUid=${targetUid}`);

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
      let countryCode = String(cData.countryCode || cData.code || '').toUpperCase();
      if (!countryCode || countryCode.length !== 2) {
        if (countryDoc.id.length === 2) {
          countryCode = countryDoc.id.toUpperCase();
        } else {
          countryCode = countryDoc.id.slice(0, 2).toUpperCase();
        }
      }

      let flag = String(cData.flag || '').trim();
      if (!flag || flag.startsWith('http://') || flag.startsWith('https://') || flag.length > 8) {
        if (countryCode.length === 2) {
          const chars = countryCode.toUpperCase().split('');
          flag = String.fromCodePoint(127397 + chars[0].charCodeAt(0), 127397 + chars[1].charCodeAt(0));
        } else {
          flag = '🌍';
        }
      }

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
