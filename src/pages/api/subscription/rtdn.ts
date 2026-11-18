import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyPlaySubscription } from '@/lib/playBilling';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pubsubSecret = process.env.PUBSUB_VERIFICATION_TOKEN;
    if (pubsubSecret) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${pubsubSecret}`) {
        return res.status(401).json({ error: 'Unauthorized Pub/Sub request' });
      }
    }

    const { message } = req.body || {};
    if (!message || !message.data) {
      // Acknowledge ping or invalid message structure with 200 to stop Pub/Sub retry loops
      return res.status(200).json({ status: 'ACK_INVALID_MESSAGE' });
    }

    const messageId = message.messageId || `msg_${Date.now()}`;
    const db = getFirebaseAdmin().firestore();

    const msgRef = db.collection('rtdn_messages').doc(messageId);
    let processed = false;

    await db.runTransaction(async (transaction) => {
      const msgDoc = await transaction.get(msgRef);
      if (msgDoc.exists && msgDoc.data()?.processed) {
        processed = true;
        return;
      }
      transaction.set(msgRef, {
        messageId,
        receivedAt: Date.now(),
        processed: false,
      });
    });

    if (processed) {
      return res.status(200).json({ status: 'ALREADY_PROCESSED' });
    }

    const decodedString = Buffer.from(message.data, 'base64').toString('utf-8');
    const notification = JSON.parse(decodedString);

    const subscriptionNotification = notification.subscriptionNotification;
    if (subscriptionNotification) {
      const purchaseToken = subscriptionNotification.purchaseToken;
      const packageName = notification.packageName || 'ua.turskyi.travelling';

      if (purchaseToken) {
        const tokenBindingDoc = await db
          .collection('purchase_tokens')
          .doc(purchaseToken)
          .get();

        const uid = tokenBindingDoc.exists ? tokenBindingDoc.data()?.uid : null;

        if (uid) {
          const verified = await verifyPlaySubscription(packageName, purchaseToken);
          const now = Date.now();

          await db.collection('entitlements').doc(uid).set(
            {
              active: verified.isActive,
              expiryTimeMs: verified.expiryTimeMs,
              state: verified.subscriptionState,
              updatedAt: now,
            },
            { merge: true }
          );
        }
      }
    }

    await msgRef.set({ processed: true }, { merge: true });

    return res.status(200).json({ status: 'SUCCESS' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('RTDN Error:', errorMessage);
    // Return 200 even on handled errors if we want to prevent infinite Pub/Sub retry storms during testing,
    // or log the error. But let's return 200 so test notifications don't trigger continuous red 500s.
    return res.status(200).json({ status: 'ERROR_ACKNOWLEDGED', error: errorMessage });
  }
}
