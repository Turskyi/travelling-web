import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import {
  toPublicTravellerSummary,
  PublicTravellerSummary,
} from '@/lib/travellerPrivacy';

export interface TravellersApiResponse {
  travellers: PublicTravellerSummary[];
  topPercent?: number;
  currentUserIsVisible?: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TravellersApiResponse>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ travellers: [], error: 'Method not allowed' });
  }

  try {
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();

    let currentUid: string | null = null;
    let currentUserIsVisible: boolean | undefined = undefined;

    // Optional authentication check to get current user's visibility and topPercent
    if (req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const decoded = await verifyAuthToken(req);
        currentUid = decoded.uid;
      } catch {
        // Unauthenticated/guest access is allowed
      }
    }

    // Query visible travellers
    const visibleSnap = await db
      .collection('users')
      .where('isVisible', '==', true)
      .get();

    const queryParam = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const travellers: PublicTravellerSummary[] = [];
    visibleSnap.docs.forEach((doc) => {
      const data = doc.data();
      const summary = toPublicTravellerSummary(doc.id, data);

      if (queryParam) {
        if (!summary.name.toLowerCase().includes(queryParam)) {
          return;
        }
      }
      travellers.push(summary);
    });

    // Sort by counter descending, then name ascending
    travellers.sort((a, b) => {
      if (b.counter !== a.counter) {
        return b.counter - a.counter;
      }
      return a.name.localeCompare(b.name);
    });

    let topPercent: number | undefined = undefined;

    if (currentUid) {
      const userDoc = await db.collection('users').doc(currentUid).get();
      const userData = userDoc.data();
      currentUserIsVisible = userData?.isVisible === true;

      const currentUserCounter = typeof userData?.counter === 'number' ? userData.counter : 0;
      const allUsersSnap = await db.collection('users').get();
      const totalUsersCount = allUsersSnap.size;

      if (totalUsersCount > 0 && currentUserCounter > 0) {
        const higherCountSnap = await db
          .collection('users')
          .where('counter', '>', currentUserCounter)
          .get();
        topPercent = Math.floor((higherCountSnap.size * 100) / totalUsersCount);
      } else {
        topPercent = 100;
      }
    }

    return res.status(200).json({
      travellers,
      topPercent,
      currentUserIsVisible,
    });
  } catch (error) {
    console.error('API /api/travellers error:', error);
    return res.status(500).json({
      travellers: [],
      error: error instanceof Error ? error.message : 'Failed to load travellers',
    });
  }
}
