import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decodedToken = await verifyAuthToken(req);
    const uid = decodedToken.uid;
    const db = getFirebaseAdmin().firestore();

    // Check if user previously rejected sync-upgrade path
    const rejectionRef = db.collection('rejections').doc(uid);
    const rejectionDoc = await rejectionRef.get();

    if (rejectionDoc.exists) {
      return res.status(403).json({
        allowed: false,
        reason: 'Sync upgrade path was permanently rejected for this user.',
      });
    }

    // Record staged migration metadata
    const migrationRef = db.collection('user_backups').doc(uid);
    await migrationRef.set(
      {
        uid,
        status: 'STAGED',
        stagedAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return res.status(200).json({ allowed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(500).json({ error: message });
  }
}
