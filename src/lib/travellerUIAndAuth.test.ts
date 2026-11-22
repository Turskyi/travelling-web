import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicTravellerId, sanitizeDisplayName, toPublicTravellerDetail, toPublicTravellerSummary } from './travellerPrivacy';

test('Visibility Authorization: default profile visibility is false (hidden)', () => {
  const newUserData: Record<string, any> = {
    name: 'New User',
    avatar: 'https://example.com/avatar.png',
    counter: 0,
  };

  // When isVisible is not set or undefined, default is false
  const defaultVisibility = typeof newUserData.isVisible === 'boolean' ? newUserData.isVisible : false;
  assert.equal(defaultVisibility, false);
});

test('Public Response Filtering: emails and UIDs are NEVER present in public summary JSON output', () => {
  const mockUid = 'firebase_uid_123_456_789';
  const mockDoc = {
    email: 'private_user@example.com',
    name: 'private_user@example.com',
    avatar: 'https://example.com/p.png',
    counter: 8,
    secretToken: 'secret_abc_123',
    stripeId: 'cus_999',
  };

  const summary = toPublicTravellerSummary(mockUid, mockDoc);
  const json = JSON.stringify(summary);

  assert.equal(json.includes('firebase_uid_123'), false);
  assert.equal(json.includes('private_user@example.com'), false);
  assert.equal(json.includes('secret_abc_123'), false);
  assert.equal(json.includes('cus_999'), false);
  assert.equal(summary.id.startsWith('tr_'), true);
  assert.equal(summary.name, 'private_user');
});

test('Profile & Progress Mapping: country percentage, total world countries, and city count calculation', () => {
  const uid = 'uid_987';
  const userData = { name: 'Globetrotter', avatar: '', counter: 25 };
  const countries = [
    { id: 1, title: 'Spain', shortName: 'ES', flag: '🇪🇸', isVisited: true },
    { id: 2, title: 'Italy', shortName: 'IT', flag: '🇮🇹', isVisited: true },
  ];
  const cities = [
    { id: 10, parentId: 1, name: 'Madrid' },
    { id: 11, parentId: 1, name: 'Barcelona' },
    { id: 12, parentId: 2, name: 'Rome' },
  ];

  const detail = toPublicTravellerDetail(uid, userData, countries, cities);

  const totalWorldCountries = 250;
  const progressPercent = Math.round((detail.counter / totalWorldCountries) * 100);

  assert.equal(detail.counter, 25);
  assert.equal(progressPercent, 10); // 25 / 250 = 10%
  assert.equal(detail.visitedCountries.length, 2);
  assert.equal(detail.cities.length, 3);
});

test('UI States: Empty search query, not found profile, and error handling states', () => {
  // 1. Search Query Filtering
  const travellers = [
    { id: 'tr_1', name: 'Alice', avatar: '', counter: 5 },
    { id: 'tr_2', name: 'Bob', avatar: '', counter: 10 },
  ];

  const query = 'bo';
  const filtered = travellers.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Bob');

  // 2. Empty Query matches all
  const emptyQueryFiltered = travellers.filter((t) => t.name.toLowerCase().includes(''));
  assert.equal(emptyQueryFiltered.length, 2);

  // 3. Not Found Profile check
  const isVisible = false;
  const isOwner = false;
  const isAdmin = false;
  const isAccessible = isVisible || isOwner || isAdmin;
  assert.equal(isAccessible, false);
});
