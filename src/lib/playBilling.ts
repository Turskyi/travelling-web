import { google } from 'googleapis';

const PLAY_SERVICE_ACCOUNT_ENV = process.env.PLAY_SERVICE_ACCOUNT_JSON;

export interface VerifiedSubscription {
  isValid: boolean;
  isActive: boolean;
  expiryTimeMs: number;
  subscriptionState: string;
  acknowledgementState: string;
  productId: string;
  basePlanId?: string;
  raw?: any;
}

export function verifyPlayServiceAccountConfiguration(): {
  configured: boolean;
  clientEmail?: string;
} {
  if (!PLAY_SERVICE_ACCOUNT_ENV) {
    return { configured: false };
  }
  try {
    const creds = JSON.parse(PLAY_SERVICE_ACCOUNT_ENV);
    return { configured: true, clientEmail: creds.client_email };
  } catch (_e) {
    return { configured: false };
  }
}

export async function verifyPlaySubscription(
  packageName: string,
  purchaseToken: string
): Promise<VerifiedSubscription> {
  if (!PLAY_SERVICE_ACCOUNT_ENV) {
    throw new Error(
      'PLAY_SERVICE_ACCOUNT_JSON is missing from environment variables on server.'
    );
  }

  const credentials = JSON.parse(PLAY_SERVICE_ACCOUNT_ENV);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  const publisher = google.androidpublisher({
    version: 'v3',
    auth,
  });

  const response = await publisher.purchases.subscriptionsv2.get({
    packageName,
    token: purchaseToken,
  });

  const data = response.data;
  const lineItem = data.lineItems?.[0];
  const productId = lineItem?.productId || '';
  const basePlanId = lineItem?.offerDetails?.basePlanId || '';
  const expiryTimeMs = lineItem?.expiryTime
    ? new Date(lineItem.expiryTime).getTime()
    : 0;

  const subscriptionState = data.subscriptionState || '';
  const isActive =
    subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' ||
    subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';

  const isValid = packageName === 'ua.turskyi.travelling' && productId === 'cloud_backup';

  return {
    isValid,
    isActive,
    expiryTimeMs,
    subscriptionState,
    acknowledgementState: data.acknowledgementState || 'ACKNOWLEDGEMENT_STATE_UNSPECIFIED',
    productId,
    basePlanId,
    raw: data,
  };
}
