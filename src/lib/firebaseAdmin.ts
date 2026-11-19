import * as admin from 'firebase-admin';
import { NextApiRequest } from 'next';

const FIREBASE_ADMIN_ENV =
  process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

export function getFirebaseAdmin(): typeof admin {
  if (admin.apps.length > 0) {
    return admin;
  }

  if (!FIREBASE_ADMIN_ENV) {
    throw new Error(
      'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON is missing from environment variables. ' +
        'Please add your server-only Firebase Admin service account JSON as a Vercel environment variable named FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON.'
    );
  }

  try {
    const serviceAccount = JSON.parse(FIREBASE_ADMIN_ENV);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.appspot.com`,
    });
  } catch (error) {
    throw new Error(
      `Failed to initialize Firebase Admin SDK: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return admin;
}

export async function verifyAuthToken(
  req: NextApiRequest
): Promise<admin.auth.DecodedIdToken> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization header');
  }

  const token = authHeader.split('Bearer ')[1];
  const app = getFirebaseAdmin();
  try {
    const decoded = await app.auth().verifyIdToken(token);
    return decoded;
  } catch (err) {
    console.error('verifyAuthToken verification failed:', err);
    throw new Error(`Unauthorized: Invalid or expired Firebase ID token (${err instanceof Error ? err.message : String(err)})`);
  }
}
