import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import { isAdminUser } from '@/lib/adminAuth';
import {
  getPublicTravellerId,
  toPublicTravellerDetail,
  PublicTravellerDetail,
} from '@/lib/travellerPrivacy';

export interface TravellerDetailApiResponse {
  traveller?: PublicTravellerDetail;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TravellerDetailApiResponse>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const publicId = typeof id === 'string' ? id.trim() : '';

  if (!publicId) {
    return res.status(400).json({ error: 'Invalid traveller ID' });
  }

  try {
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();

    let requesterUid: string | null = null;
    let requesterIsAdmin = false;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const decoded = await verifyAuthToken(req);
        requesterUid = decoded.uid;
        requesterIsAdmin = isAdminUser(decoded);
      } catch {
        // Unauthenticated access
      }
    }

    // Find user document matching publicId
    const usersSnap = await db.collection('users').get();
    let targetDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    for (const doc of usersSnap.docs) {
      if (getPublicTravellerId(doc.id) === publicId) {
        targetDoc = doc;
        break;
      }
    }

    if (!targetDoc || !targetDoc.exists) {
      return res.status(404).json({ error: 'Traveller not found' });
    }

    const targetUid = targetDoc.id;
    const userData = targetDoc.data() || {};
    const isVisible = userData.isVisible === true;

    const isOwner = requesterUid === targetUid;

    // Privacy check: profile must be visible unless owner or admin
    if (!isVisible && !isOwner && !requesterIsAdmin) {
      return res.status(404).json({ error: 'Traveller not found' });
    }

    // Fetch subcollections
    const countriesSnap = await targetDoc.ref.collection('visited_countries').get();
    const citiesSnap = await targetDoc.ref.collection('cities').get();

    const countriesData = countriesSnap.docs.map((d) => d.data());
    const citiesData = citiesSnap.docs.map((d) => d.data());

    const traveller = toPublicTravellerDetail(
      targetUid,
      userData,
      countriesData,
      citiesData,
    );

    return res.status(200).json({ traveller });
  } catch (error) {
    console.error('API /api/travellers/[id] error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load traveller details',
    });
  }
}
