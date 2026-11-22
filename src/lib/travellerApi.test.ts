import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicTravellerId, toPublicTravellerDetail, toPublicTravellerSummary } from './travellerPrivacy';

test('Public API summary mapper NEVER exposes email, raw UID, or secret tokens', () => {
  const rawData = {
    email: 'sensitive_user@domain.com',
    name: 'sensitive_user@domain.com',
    avatar: 'https://lh3.googleusercontent.com/photo.jpg',
    counter: 12,
    isAdmin: false,
    stripeCustomerId: 'cus_12345',
  };
  const uid = 'firebase_user_uid_123';

  const summary = toPublicTravellerSummary(uid, rawData);

  assert.equal(summary.id, getPublicTravellerId(uid));
  assert.equal(summary.id.includes('firebase_user'), false);
  assert.equal(summary.name, 'sensitive_user');
  assert.equal(summary.name.includes('@domain.com'), false);

  const jsonString = JSON.stringify(summary);
  assert.equal(jsonString.includes('sensitive_user@domain.com'), false);
  assert.equal(jsonString.includes('firebase_user_uid_123'), false);
  assert.equal(jsonString.includes('cus_12345'), false);
});
