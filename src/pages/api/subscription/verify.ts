import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import { verifyPlaySubscription } from '@/lib/playBilling';
import { google } from 'googleapis';

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
    const { purchaseToken, packageName = 'ua.turskyi.travelling' } = req.body;

    if (!purchaseToken) {
      return res.status(400).json({ error: 'Missing purchaseToken' });
    }

    if (packageName !== 'ua.turskyi.travelling') {
      return res.status(400).json({ error: 'Invalid package name' });
    }

    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();

    // Verify subscription with Google Play Developer API
    const verified = await verifyPlaySubscription(packageName, purchaseToken);

    if (!verified.isValid || verified.productId !== 'cloud_backup' || verified.basePlanId !== 'monthly') {
      return res.status(400).json({ error: 'Invalid product or base plan' });
    }

    const now = Date.now();

    // Atomic transaction for purchase token binding
    const tokenBindingRef = db.collection('purchase_tokens').doc(purchaseToken);
    await db.runTransaction(async (transaction) => {
      const tokenDoc = await transaction.get(tokenBindingRef);
      if (tokenDoc.exists) {
        const boundUid = tokenDoc.data()?.uid;
        if (boundUid && boundUid !== uid) {
          throw new Error('This purchase token is already bound to a different account.');
        }
      }
      transaction.set(tokenBindingRef, {
        uid,
        purchaseToken,
        packageName,
        productId: verified.productId,
        basePlanId: verified.basePlanId,
        boundAt: now,
        updatedAt: now,
      });
    });

    // Acknowledge purchase if not already acknowledged
    if (verified.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' || verified.acknowledgementState === '0') {
      try {
        const credentials = JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON || '{}');
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/androidpublisher'],
        });
        const publisher = google.androidpublisher({ version: 'v3', auth });
        await publisher.purchases.subscriptions.acknowledge({
          packageName,
          subscriptionId: 'cloud_backup',
          token: purchaseToken,
          requestBody: { developerPayload: uid },
        });
      } catch (_ackErr) {
        // May already be acknowledged
      }
    }

    // Save server-owned entitlement
    const entitlementRef = db.collection('entitlements').doc(uid);
    await entitlementRef.set(
      {
        uid,
        active: verified.isActive,
        expiryTimeMs: verified.expiryTimeMs,
        purchaseToken,
        productId: verified.productId,
        basePlanId: verified.basePlanId,
        state: verified.subscriptionState,
        acknowledgementState: verified.acknowledgementState,
        updatedAt: now,
      },
      { merge: true }
    );

    if (verified.isActive) {
      await db.collection('user_backups').doc(uid).set(
        {
          status: 'CONFIRMED',
          confirmedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return res.status(200).json({
      active: verified.isActive,
      expiryTimeMs: verified.expiryTimeMs,
      state: verified.subscriptionState,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(400).json({ error: message });
  }
}
