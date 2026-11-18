import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAuthToken } from '@/lib/firebaseAdmin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decodedToken = await verifyAuthToken(req);
    return res.status(200).json({
      uid: decodedToken.uid,
      email: decodedToken.email || '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return res.status(401).json({ error: message });
  }
}
