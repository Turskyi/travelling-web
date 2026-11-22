import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  sanitizeShareCode,
  sanitizeFriendCodes,
  sanitizeVisibility,
} from '../pages/api/travellers/profile';
import { matchesSearchQuery } from '../pages/api/travellers/search';

describe('Traveller Helper Functions', () => {
  test('sanitizeShareCode normalizes code', () => {
    assert.strictEqual(sanitizeShareCode(' abc-123! '), 'ABC123');
    assert.strictEqual(sanitizeShareCode('aB123c456d789e000'), 'AB123C456D789E00');
    assert.strictEqual(sanitizeShareCode(null), '');
    assert.strictEqual(sanitizeShareCode(undefined), '');
  });

  test('sanitizeFriendCodes returns deduplicated uppercase codes', () => {
    assert.deepStrictEqual(
      sanitizeFriendCodes([' abc-123 ', 'ABC123', ' def456 ']),
      ['ABC123', 'DEF456']
    );
    assert.deepStrictEqual(sanitizeFriendCodes('not-an-array'), []);

    const many = Array.from({ length: 600 }, (_, i) => `CODE${i}`);
    assert.strictEqual(sanitizeFriendCodes(many).length, 500);
  });

  test('sanitizeVisibility handles all cases', () => {
    assert.strictEqual(sanitizeVisibility('everyone'), 'everyone');
    assert.strictEqual(sanitizeVisibility('friends'), 'friends');
    assert.strictEqual(sanitizeVisibility('privateProfile'), 'privateProfile');
    assert.strictEqual(sanitizeVisibility('invalid'), 'privateProfile');
  });

  test('matchesSearchQuery filters names case-insensitively', () => {
    assert.strictEqual(matchesSearchQuery('Dmytro Turskyi', 'dmytro'), true);
    assert.strictEqual(matchesSearchQuery('Dmytro Turskyi', 'TURSKYI'), true);
    assert.strictEqual(matchesSearchQuery('Dmytro Turskyi', 'alex'), false);
    assert.strictEqual(matchesSearchQuery('Dmytro Turskyi', ''), true);
  });
});
