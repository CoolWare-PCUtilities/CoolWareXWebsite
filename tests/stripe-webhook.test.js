const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { verifyStripeSignature, readRawBody } = require('../netlify/functions/stripe-webhook');

test('verifyStripeSignature accepts valid signature', () => {
  const secret = 'whsec_test';
  const payload = '{"id":"evt_1"}';
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const header = `t=${timestamp},v1=${sig}`;
  assert.equal(verifyStripeSignature(payload, header, secret), true);
});

test('readRawBody decodes base64 payload', () => {
  const payload = '{"ok":true}';
  const event = { body: Buffer.from(payload, 'utf8').toString('base64'), isBase64Encoded: true };
  assert.equal(readRawBody(event), payload);
});
