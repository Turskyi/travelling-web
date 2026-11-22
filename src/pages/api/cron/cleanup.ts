import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET environment variable is missing.' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized cron request' });
  }

  try {
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();
    const now = Date.now();

    let cleanedStaged = 0;
    let cleanedExpired = 0;

    // 1. Cleanup abandoned staged migrations (>30 days) - paginated limit 100
    const stagedBackups = await db
      .collection('user_backups')
      .where('status', '==', 'STAGED')
      .limit(100)
      .get();

    for (const doc of stagedBackups.docs) {
      const data = doc.data();
      const stagedAt = data.stagedAt || 0;
      if (now - stagedAt > THIRTY_DAYS_MS) {
        await db.recursiveDelete(doc.ref);
        cleanedStaged++;
      }
    }

    // 2. Cleanup expired user cloud data (>30 days past subscription expiry) - paginated limit 100
    const entitlements = await db
      .collection('entitlements')
      .where('active', '==', false)
      .limit(100)
      .get();

    for (const doc of entitlements.docs) {
      const data = doc.data();
      const expiryTimeMs = data.expiryTimeMs || 0;
      const uid = doc.id;

      if (expiryTimeMs > 0 && now - expiryTimeMs > THIRTY_DAYS_MS) {
        const backupRef = db.collection('user_backups').doc(uid);
        const backupDoc = await backupRef.get();
        if (backupDoc.exists) {
          await db.recursiveDelete(backupRef);
          cleanedExpired++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      cleanedStaged,
      cleanedExpired,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(500).json({ error: message });
  }
}
