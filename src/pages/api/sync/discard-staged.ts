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

    // Check if entitlement is active. If active, do NOT discard backup!
    const entitlementDoc = await db.collection('entitlements').doc(uid).get();
    if (entitlementDoc.exists && entitlementDoc.data()?.active) {
      return res.status(200).json({ success: true, note: 'User is active subscriber, kept backup' });
    }

    // Delete staged data in user_backups/{uid}
    const backupRef = db.collection('user_backups').doc(uid);
    await db.recursiveDelete(backupRef);

    return res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(500).json({ error: message });
  }
}
