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
    console.log(`[API /api/travellers/search] viewerUid=${viewerUid}, query="${queryStr}"`);

    const viewerUserDoc = await db.collection('users').doc(viewerUid).get();
    const viewerData = viewerUserDoc.data() || {};
    const viewerShareCode = sanitizeShareCode(viewerData.shareCode) || String(viewerUid.slice(0, 8)).toUpperCase();
    console.log(`[API /api/travellers/search] viewerShareCode=${viewerShareCode}`);

    const usersSnap = await db.collection('users').limit(200).get();
    console.log(`[API /api/travellers/search] Fetched ${usersSnap.size} user documents from Firestore.`);

    const results: TravellerSearchResult[] = [];

    for (const doc of usersSnap.docs) {
      const id = doc.id;
      if (id === viewerUid) {
        console.log(`[API /api/travellers/search] Skipping self (id=${id})`);
        continue;
      }

      const data = doc.data();
      const visibility = sanitizeVisibility(data.visibility);
      const friendCodes = Array.isArray(data.friendCodes)
        ? data.friendCodes.map((c: unknown) => sanitizeShareCode(c))
        : [];

      let isPermitted = false;
      if (
        visibility === 'everyone' ||
        data.isVisible === true ||
        (data.isVisible !== false && visibility !== 'privateProfile')
      ) {
        isPermitted = true;
      } else if (visibility === 'friends') {
        isPermitted = Boolean(viewerShareCode && friendCodes.includes(viewerShareCode));
      }

      console.log(`[API /api/travellers/search] Candidate id=${id}, name="${data.displayName || data.name}", visibility="${data.visibility}", isVisible=${data.isVisible}, isPermitted=${isPermitted}`);

      if (!isPermitted) continue;

      const displayName = String(data.displayName || data.name || 'Traveller').trim();
      const shareCode = sanitizeShareCode(data.shareCode) || String(id.slice(0, 8)).toUpperCase();
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
    console.log(`[API /api/travellers/search] Returning ${results.length} travellers.`);

    return res.status(200).json({ travellers: results });
  } catch (error) {
    console.error('API /api/travellers/search error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
