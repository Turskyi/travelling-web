import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getPublicTravellerId,
  sanitizeDisplayName,
  toPublicTravellerDetail,
  toPublicTravellerSummary,
} from './travellerPrivacy';

test('getPublicTravellerId generates deterministic opaque ID without exposing raw UID', () => {
  const uid = 'user123_abc_xyz';
  const publicId1 = getPublicTravellerId(uid);
  const publicId2 = getPublicTravellerId(uid);

  assert.notEqual(publicId1, uid);
  assert.equal(publicId1.startsWith('tr_'), true);
  assert.equal(publicId1, publicId2);
  assert.equal(publicId1.includes('user123'), false);
});

test('sanitizeDisplayName removes email addresses and provides safe defaults', () => {
  assert.equal(sanitizeDisplayName('John Doe'), 'John Doe');
  assert.equal(sanitizeDisplayName('john.doe@example.com'), 'john.doe');
  assert.equal(sanitizeDisplayName(''), 'Traveller');
  assert.equal(sanitizeDisplayName(null), 'Traveller');
});

test('toPublicTravellerSummary strips private fields', () => {
  const uid = 'raw_firebase_uid_99';
  const docData = {
    email: 'private@example.com',
    name: 'Jane Traveller',
    avatar: 'https://example.com/photo.jpg',
    counter: 5,
    isAdmin: true,
    secretToken: 'secret123',
  };

  const summary = toPublicTravellerSummary(uid, docData);

  assert.equal(summary.id, getPublicTravellerId(uid));
  assert.equal(summary.name, 'Jane Traveller');
  assert.equal(summary.avatar, 'https://example.com/photo.jpg');
  assert.equal(summary.counter, 5);

  // Verify private fields are absent
  assert.equal('email' in summary, false);
  assert.equal('isAdmin' in summary, false);
  assert.equal('secretToken' in summary, false);
  assert.equal('uid' in summary, false);
});

test('toPublicTravellerDetail maps visited countries and cities without private fields', () => {
  const uid = 'user_777';
  const docData = { name: 'user@test.com', avatar: '', counter: 1 };
  const countriesData = [
    { id: 10, title: 'Ukraine', shortName: 'UA', flag: '🇺🇦', isVisited: true, internalNote: 'private' },
    { id: 20, title: 'France', shortName: 'FR', flag: '🇫🇷', isVisited: false },
  ];
  const citiesData = [
    { id: 100, parentId: 10, name: 'Kyiv', month: '2023-05', secretCityKey: '123' },
  ];

  const detail = toPublicTravellerDetail(uid, docData, countriesData, citiesData);

  assert.equal(detail.name, 'user'); // Email domain stripped
  assert.equal(detail.visitedCountries.length, 1); // Only visited=true country
  assert.equal(detail.visitedCountries[0].name, 'Ukraine');
  assert.equal('internalNote' in detail.visitedCountries[0], false);
  assert.equal(detail.cities.length, 1);
  assert.equal(detail.cities[0].name, 'Kyiv');
  assert.equal('secretCityKey' in detail.cities[0], false);
});
