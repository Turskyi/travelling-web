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
    const bucket = adminApp.storage().bucket();

    // 1. Discover and delete Pro selfie files from Storage under `selfies/{selfieName}`
    try {
      const visitedCountriesSnap = await db
        .collection('users')
        .doc(uid)
        .collection('visited_countries')
        .get();

      for (const doc of visitedCountriesSnap.docs) {
        const data = doc.data();
        const selfieName = data.selfieName;
        const selfiePath =
          typeof selfieName === 'string' &&
          (/^\d{1,20}$/.test(selfieName) || /^[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(selfieName))
            ? `selfies/${selfieName}`
            : typeof data.selfie === 'string' &&
                /^selfies\/[A-Za-z0-9_-]+(?:\.(jpg|png|webp))?$/.test(data.selfie)
              ? data.selfie
              : undefined;
        if (selfiePath) {
          try {
            await bucket.file(selfiePath).delete();
          } catch (_e) {
            // Ignore if specific file doesn't exist in storage
          }
        }
      }
    } catch (_e) {
      // Ignore if user collection doesn't exist
    }

    // 2. Delete Firestore documents across Travelling apps
    const collectionsToDelete = ['user_backups', 'users', 'rejections', 'entitlements'];
    for (const coll of collectionsToDelete) {
      const docRef = db.collection(coll).doc(uid);
      const doc = await docRef.get();
      if (doc.exists) {
        await db.recursiveDelete(docRef);
      }
    }

    // 3. Delete Firebase Auth user record LAST
    await adminApp.auth().deleteUser(uid);

    return res.status(200).json({
      success: true,
      message:
        'Your cloud backup, profile data, and authentication record have been permanently deleted across Travelling apps. ' +
        'Note: This does not automatically cancel your active Google Play subscription. Please manage or cancel subscriptions in Google Play Store.',
      manageSubscriptionsUrl: 'https://play.google.com/store/account/subscriptions',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(500).json({ error: message });
  }
}
