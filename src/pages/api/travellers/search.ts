import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import { sanitizeShareCode, sanitizeVisibility } from './profile';

export interface TravellerSearchResult {
  id: string;
  displayName: string;
  shareCode: string;
  visitedCountryCount: number;
}

export function matchesSearchQuery(name: string, query: string): boolean {
  if (!query) return true;
  const normalizedName = name.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  return normalizedName.includes(normalizedQuery);
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

    const queryStr = String(req.query.q || req.query.namePrefix || '').trim().slice(0, 50);

    const viewerUserDoc = await db.collection('users').doc(viewerUid).get();
    const viewerTravellerDoc = await db.collection('travellers').doc(viewerUid).get();
    const viewerData = viewerUserDoc.data() || viewerTravellerDoc.data() || {};
    const viewerShareCode = sanitizeShareCode(viewerData.shareCode) || String(viewerUid.slice(0, 8)).toUpperCase();

    const candidatesMap = new Map<string, FirebaseFirestore.DocumentData>();

    const publicUsersSnap = await db.collection('users')
      .where('visibility', '==', 'everyone')
      .limit(100)
      .get();
    for (const doc of publicUsersSnap.docs) {
      candidatesMap.set(doc.id, doc.data());
    }

    const publicTravellersSnap = await db.collection('travellers')
      .where('visibility', '==', 'everyone')
      .limit(100)
      .get();
    for (const doc of publicTravellersSnap.docs) {
      if (!candidatesMap.has(doc.id)) {
        candidatesMap.set(doc.id, doc.data());
      }
    }

    if (viewerShareCode) {
      const friendsUsersSnap = await db.collection('users')
        .where('visibility', '==', 'friends')
        .where('friendCodes', 'array-contains', viewerShareCode)
        .limit(100)
        .get();
      for (const doc of friendsUsersSnap.docs) {
        if (!candidatesMap.has(doc.id)) {
          candidatesMap.set(doc.id, doc.data());
        }
      }

      const friendsTravellersSnap = await db.collection('travellers')
        .where('visibility', '==', 'friends')
        .where('friendCodes', 'array-contains', viewerShareCode)
        .limit(100)
        .get();
      for (const doc of friendsTravellersSnap.docs) {
        if (!candidatesMap.has(doc.id)) {
          candidatesMap.set(doc.id, doc.data());
        }
      }
    }

    const results: TravellerSearchResult[] = [];

    for (const [id, data] of candidatesMap.entries()) {
      if (id === viewerUid) continue;

      const visibility = sanitizeVisibility(data.visibility);
      const friendCodes = Array.isArray(data.friendCodes)
        ? data.friendCodes.map((c: unknown) => sanitizeShareCode(c))
        : [];

      let isPermitted = false;
      if (visibility === 'everyone') {
        isPermitted = true;
      } else if (visibility === 'friends') {
        isPermitted = Boolean(viewerShareCode && friendCodes.includes(viewerShareCode));
      }

      if (!isPermitted) continue;

      const displayName = String(data.displayName || data.name || 'Traveller').trim();
      const shareCode = sanitizeShareCode(data.shareCode);
      const visitedCountryCount = typeof data.visitedCountryCount === 'number'
        ? data.visitedCountryCount
        : (typeof data.counter === 'number' ? data.counter : 0);

      if (matchesSearchQuery(displayName, queryStr)) {
        results.push({
          id,
          displayName,
          shareCode,
          visitedCountryCount,
        });
      }

      if (results.length >= 50) break;
    }

    results.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return res.status(200).json({ travellers: results });
  } catch (error) {
    console.error('API /api/travellers/search error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
