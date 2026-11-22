import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import { sanitizeShareCode, sanitizeVisibility } from './profile';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decodedToken = await verifyAuthToken(req);
    const viewerUid = decodedToken.uid;
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();

    const rawCode = req.body?.code;
    const targetCode = sanitizeShareCode(rawCode);

    if (!targetCode) {
      return res.status(400).json({ error: 'A valid traveller code is required.' });
    }

    let candidateDoc: FirebaseFirestore.DocumentSnapshot | undefined;

    const userMatchSnap = await db.collection('users')
      .where('shareCode', '==', targetCode)
      .limit(1)
      .get();
    if (!userMatchSnap.empty) {
      candidateDoc = userMatchSnap.docs[0];
    } else {
      const allUsersSnap = await db.collection('users').limit(200).get();
      for (const doc of allUsersSnap.docs) {
        const docShareCode = sanitizeShareCode(doc.data().shareCode) || String(doc.id.slice(0, 8)).toUpperCase();
        if (docShareCode === targetCode) {
          candidateDoc = doc;
          break;
        }
      }
    }

    if (!candidateDoc || !candidateDoc.exists) {
      return res.status(404).json({ error: 'No traveller was found with that code.' });
    }

    const candidateUid = candidateDoc.id;
    if (candidateUid === viewerUid) {
      return res.status(400).json({ error: "You can't add your own traveller code." });
    }

    const data = candidateDoc.data() || {};
    const visibility = sanitizeVisibility(data.visibility);

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

    const displayName = String(data.displayName || data.name || 'Traveller').trim();
    const visitedCountryCount = typeof data.visitedCountryCount === 'number'
      ? data.visitedCountryCount
      : (typeof data.counter === 'number' ? data.counter : 0);

    return res.status(200).json({
      success: true,
      traveller: {
        id: candidateUid,
        displayName,
        shareCode: targetCode,
        visitedCountryCount,
      },
    });
  } catch (error) {
    console.error('API /api/travellers/add-friend error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
