import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import { getSelfieObjectPath } from '@/lib/selfieObjectPath';
import { sanitizeShareCode, sanitizeVisibility } from './profile';

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

    const travellerId = String(req.query.travellerId || req.query.uid || '').trim();
    const countryCode = String(req.query.countryCode || '').trim().toUpperCase();

    if (!travellerId || !countryCode) {
      return res.status(400).json({ error: 'travellerId and countryCode are required.' });
    }

    const travellerUserDoc = await db.collection('users').doc(travellerId).get();
    const travellerProfileDoc = await db.collection('travellers').doc(travellerId).get();

    if (!travellerUserDoc.exists && !travellerProfileDoc.exists) {
      return res.status(404).json({ error: 'Traveller profile not found.' });
    }

    const tData = travellerUserDoc.data() || travellerProfileDoc.data() || {};
    const visibility = sanitizeVisibility(tData.visibility);

    if (travellerId !== viewerUid) {
      if (visibility === 'privateProfile') {
        return res.status(403).json({ error: "This traveller hasn't shared their list." });
      }

      if (visibility === 'friends') {
        const viewerUserDoc = await db.collection('users').doc(viewerUid).get();
        const viewerTravellerDoc = await db.collection('travellers').doc(viewerUid).get();
        const viewerData = viewerUserDoc.data() || viewerTravellerDoc.data() || {};
        const viewerShareCode = sanitizeShareCode(viewerData.shareCode) || String(viewerUid.slice(0, 8)).toUpperCase();

        const candidateFriendCodes = Array.isArray(tData.friendCodes)
          ? tData.friendCodes.map((c: unknown) => sanitizeShareCode(c))
          : [];

        if (!viewerShareCode || !candidateFriendCodes.includes(viewerShareCode)) {
          return res.status(403).json({
            error: 'This private traveller must add your code before sharing their list.',
          });
        }
      }
    }

    const targetUserRef = db.collection('users').doc(travellerId);
    const visitedCountriesSnap = await targetUserRef.collection('visited_countries').get();

    let matchedDoc: FirebaseFirestore.DocumentData | undefined;
    for (const doc of visitedCountriesSnap.docs) {
      const data = doc.data();
      const code = String(data.countryCode || '').toUpperCase();
      if (code === countryCode) {
        matchedDoc = data;
        break;
      }
    }

    if (!matchedDoc) {
      for (const doc of visitedCountriesSnap.docs) {
        const data = doc.data();
        const docIdCode = doc.id.toUpperCase();
        if (docIdCode === countryCode) {
          matchedDoc = data;
          break;
        }
      }
    }

    if (!matchedDoc) {
      return res.status(404).json({ error: 'No photo found for this country.' });
    }

    const objectPath = getSelfieObjectPath(matchedDoc, bucket.name);
    if (!objectPath) {
      return res.status(404).json({ error: 'No photo found for this country.' });
    }

    const [url] = await bucket.file(objectPath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000,
    });

    return res.status(200).json({ url });
  } catch (error) {
    console.error('API /api/travellers/photo error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
