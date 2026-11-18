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
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();

    // 1. Mark permanently rejected
    await db.collection('rejections').doc(uid).set({
      rejectedAt: Date.now(),
      uid,
    });

    // 2. Delete staged data in user_backups/{uid}
    const backupRef = db.collection('user_backups').doc(uid);
    await db.recursiveDelete(backupRef);

    // 3. Delete staged Storage selfies if any
    try {
      const bucket = adminApp.storage().bucket();
      await bucket.deleteFiles({ prefix: `cloud_sync/selfies/${uid}/` });
    } catch (_e) {
      // Storage files might not exist
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(500).json({ error: message });
  }
}
