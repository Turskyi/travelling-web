import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decodedToken = await verifyAuthToken(req);
    const uid = decodedToken.uid;
    const db = getFirebaseAdmin().firestore();

    const entitlementDoc = await db.collection('entitlements').doc(uid).get();

    if (!entitlementDoc.exists) {
      return res.status(200).json({
        active: false,
        expiryTimeMs: 0,
        state: 'SUBSCRIPTION_STATE_UNSPECIFIED',
        hasBackup: false,
      });
    }

    const data = entitlementDoc.data();
    const now = Date.now();
    const expiryTimeMs = data?.expiryTimeMs || 0;
    const active = data?.active === true && expiryTimeMs > now;

    // Check if cloud backup data exists
    const backupDoc = await db.collection('user_backups').doc(uid).get();

    return res.status(200).json({
      active,
      expiryTimeMs,
      state: data?.state || 'SUBSCRIPTION_STATE_UNSPECIFIED',
      hasBackup: backupDoc.exists,
      backupStatus: backupDoc.data()?.status || 'NONE',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(500).json({ error: message });
  }
}
