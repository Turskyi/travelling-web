import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';

export interface VisibilityApiResponse {
  isVisible?: boolean;
  success?: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VisibilityApiResponse>,
) {
  try {
    const decodedToken = await verifyAuthToken(req);
    const uid = decodedToken.uid;
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();
    const userRef = db.collection('users').doc(uid);

    if (req.method === 'GET') {
      const userDoc = await userRef.get();
      const isVisible = userDoc.exists && userDoc.data()?.isVisible === true;
      return res.status(200).json({ isVisible });
    }

    if (req.method === 'POST') {
      const { isVisible } = req.body || {};

      if (typeof isVisible !== 'boolean') {
        return res.status(400).json({ error: 'isVisible boolean property is required.' });
      }

      await userRef.set(
        {
          id: uid,
          name: decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'Traveller'),
          avatar: decodedToken.picture || '',
          isVisible,
          updatedAt: Date.now(),
        },
        { merge: true },
      );

      return res.status(200).json({ success: true, isVisible });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
