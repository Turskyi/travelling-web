import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyAuthToken } from '@/lib/firebaseAdmin';
import { isAdminUser } from '@/lib/adminAuth';
import { getSelfieObjectPath } from '@/lib/selfieObjectPath';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface SelfieRequest {
  countryCode?: string;
  countryName?: string;
  mimeType?: string;
  imageBase64?: string;
}

function countryDocumentId(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 120);
}

async function findCountryDocument(
  userRef: FirebaseFirestore.DocumentReference,
  countryName: string,
) {
  const countries = userRef.collection('visited_countries');
  const direct = await countries.doc(countryDocumentId(countryName)).get();
  if (direct.exists) return direct;

  const normalizedName = countryName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const snapshot = await countries.get();
  return snapshot.docs.find((doc) =>
    [doc.id, doc.data().shortName, doc.data().name, doc.data().title]
      .some((value) =>
        typeof value === 'string' &&
        value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName,
      ),
  );
}

function hasExpectedImageSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

function fileExtension(mimeType: string) {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice('image/'.length);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decodedToken = await verifyAuthToken(req);
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();
    const uid = decodedToken.uid;
    const entitlement = (await db.collection('entitlements').doc(uid).get()).data();
    const isEntitled =
      isAdminUser(decodedToken) ||
      process.env.FREE_ACCESS_FOR_ALL === 'true' ||
      (entitlement?.active === true && Number(entitlement.expiryTimeMs) > Date.now());
    if (req.method === 'POST' && !isEntitled) {
      return res.status(403).json({ error: 'An active cloud backup subscription is required to upload selfies.' });
    }

    const body = (req.method === 'GET' || req.method === 'DELETE'
      ? req.query
      : req.body) as SelfieRequest;
    const countryCode = String(body.countryCode || '').toUpperCase();
    const countryName = String(body.countryName || '').trim();
    if (!/^[A-Z0-9]{2,3}$/.test(countryCode) || !countryName || countryName.length > 120) {
      return res.status(400).json({ error: 'A valid country code and name are required.' });
    }

    const docId = countryDocumentId(countryName);
    if (!docId) return res.status(400).json({ error: 'Invalid country name.' });
    const userRef = db.collection('users').doc(uid);
    const countryRef = userRef.collection('visited_countries').doc(docId);
    const countryDoc = req.method === 'GET' || req.method === 'DELETE'
      ? await findCountryDocument(userRef, countryName)
      : await countryRef.get();
    const bucket = adminApp.storage().bucket();

    if (req.method === 'GET') {
      const countryData = countryDoc?.data();
      const objectPath = countryData
        ? getSelfieObjectPath(countryData, bucket.name)
        : undefined;
      if (!objectPath) {
        return res.status(404).json({ error: 'No cloud selfie is saved for this country.' });
      }
      const [url] = await bucket.file(objectPath).getSignedUrl({
        action: 'read',
        expires: Date.now() + 5 * 60 * 1000,
      });
      return res.status(200).json({ url, selfieName: objectPath });
    }

    if (req.method === 'DELETE') {
      const countryData = countryDoc?.data();
      const objectPath = countryData
        ? getSelfieObjectPath(countryData, bucket.name)
        : undefined;
      if (objectPath) {
        await bucket.file(objectPath).delete({ ignoreNotFound: true });
      }
      await (countryDoc?.ref || countryRef).set(
        { selfie: '', selfieName: '', updatedAt: Date.now() },
        { merge: true },
      );
      return res.status(200).json({ success: true });
    }

    const mimeType = String(body.mimeType || '').toLowerCase();
    const encodedImage = String(body.imageBase64 || '');
    if (!ALLOWED_TYPES.has(mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedImage)) {
      return res.status(400).json({ error: 'Choose a JPEG, PNG, or WebP image.' });
    }

    const image = Buffer.from(encodedImage, 'base64');
    if (image.length === 0 || image.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Selfie images must be no larger than 2 MB.' });
    }
    if (!hasExpectedImageSignature(image, mimeType)) {
      return res.status(400).json({ error: 'The image content does not match its file type.' });
    }

    const selfieName = `${Date.now()}_${uid}.${fileExtension(mimeType)}`;
    const selfiePath = `selfies/${selfieName}`;
    const previousSelfiePath = countryDoc
      ? getSelfieObjectPath(countryDoc.data() || {}, bucket.name)
      : undefined;
    const file = bucket.file(selfiePath);
    await file.save(image, {
      resumable: false,
      metadata: {
        contentType: mimeType,
        cacheControl: 'private, max-age=300',
        metadata: { uid, countryCode, countryName },
      },
    });

    const selfie = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000,
    });
    await countryRef.set(
      {
        title: countryName,
        flag: String(req.body.flag || ''),
        isVisited: true,
        selfie: selfiePath,
        selfieName,
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    if (previousSelfiePath && previousSelfiePath !== selfieName) {
      await bucket.file(previousSelfiePath).delete({ ignoreNotFound: true });
    }

    return res.status(200).json({ success: true, selfieName: selfiePath, url: selfie[0] });
  } catch (error) {
    console.error('API /api/sync/selfie error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '3mb',
    },
  },
};
