import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';

export function sanitizeShareCode(rawCode: unknown): string {
  if (typeof rawCode !== 'string') return '';
  return rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

export function sanitizeFriendCodes(rawCodes: unknown): string[] {
  if (!Array.isArray(rawCodes)) return [];
  const set = new Set<string>();
  for (const item of rawCodes) {
    const code = sanitizeShareCode(item);
    if (code) {
      set.add(code);
    }
    if (set.size >= 500) break;
  }
  return Array.from(set);
}

export function sanitizeVisibility(rawVisibility: unknown): 'privateProfile' | 'friends' | 'everyone' {
  if (rawVisibility === 'everyone') return 'everyone';
  if (rawVisibility === 'friends') return 'friends';
  return 'privateProfile';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!['GET', 'POST', 'PUT'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decodedToken = await verifyAuthToken(req);
    const uid = decodedToken.uid;
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();

    const userRef = db.collection('users').doc(uid);
    const travellerRef = db.collection('travellers').doc(uid);

    if (req.method === 'GET') {
      const doc = await userRef.get();
      const travellerDoc = await travellerRef.get();
      const data = doc.data() || travellerDoc.data() || {};

      const shareCode = sanitizeShareCode(data.shareCode) || String(uid.slice(0, 8)).toUpperCase();
      const visibility = sanitizeVisibility(data.visibility);
      const friendCodes = sanitizeFriendCodes(data.friendCodes);
      const displayName = String(data.displayName || data.name || decodedToken.name || decodedToken.email || 'Traveller').slice(0, 100);
      const visitedCountryCount = typeof data.visitedCountryCount === 'number' ? data.visitedCountryCount : (typeof data.counter === 'number' ? data.counter : 0);

      return res.status(200).json({
        profile: {
          displayName,
          shareCode,
          visibility,
          friendCodes,
          visitedCountryCount,
        },
      });
    }

    const {
      displayName: rawName,
      shareCode: rawCode,
      visibility: rawVis,
      friendCodes: rawFriends,
      visitedCountryCount: rawCount,
    } = req.body || {};

    const displayName = String(rawName || decodedToken.name || decodedToken.email || 'Traveller').trim().slice(0, 100);
    let shareCode = sanitizeShareCode(rawCode);
    if (!shareCode) {
      const existingDoc = await userRef.get();
      shareCode = sanitizeShareCode(existingDoc.data()?.shareCode) || String(uid.slice(0, 8)).toUpperCase();
    }
    const visibility = sanitizeVisibility(rawVis);
    const friendCodes = sanitizeFriendCodes(rawFriends);
    const visitedCountryCount = typeof rawCount === 'number' && rawCount >= 0 ? Math.floor(rawCount) : 0;
    const now = Date.now();

    const profilePayload = {
      id: uid,
      displayName,
      name: displayName,
      shareCode,
      visibility,
      isVisible: visibility === 'everyone',
      friendCodes,
      visitedCountryCount,
      counter: visitedCountryCount,
      updatedAt: now,
    };

    const batch = db.batch();
    batch.set(userRef, profilePayload, { merge: true });
    batch.set(travellerRef, profilePayload, { merge: true });
    await batch.commit();

    return res.status(200).json({
      success: true,
      profile: {
        displayName,
        shareCode,
        visibility,
        friendCodes,
        visitedCountryCount,
      },
    });
  } catch (error) {
    console.error('API /api/travellers/profile error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
