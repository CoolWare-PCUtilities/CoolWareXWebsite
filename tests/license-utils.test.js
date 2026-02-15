const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeEmail, maskLicenseKey, sha256Hex } = require('../netlify/functions/lib/license');
const { maskEmail } = require('../netlify/functions/lib/logging');

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  USER+tag@Example.COM '), 'user+tag@example.com');
});

test('sha256Hex is deterministic', () => {
  assert.equal(
    sha256Hex('test@example.com'),
    '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b'
  );
});

test('maskLicenseKey redacts long values', () => {
  const key = 'COOLWAREX-abcdefghijklmnopqrstuvwxyz.1234567890';
  assert.match(maskLicenseKey(key), /^COOLWAREX-ab\.\.\..+/);
});

test('maskEmail redacts local part', () => {
  assert.equal(maskEmail('person@example.com'), 'pe***@example.com');
});
