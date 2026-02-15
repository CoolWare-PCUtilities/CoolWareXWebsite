const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { verifyStripeSignature, readRawBody, parseStripeSignature } = require('../netlify/functions/stripe-webhook');

test('verifyStripeSignature accepts valid signature with multiple v1 values', () => {
  const secret = 'whsec_test';
  const payload = Buffer.from('{"id":"evt_1"}', 'utf8');
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(payload).digest('hex');
  const header = `t=${timestamp},v1=badbad,v1=${sig}`;
  assert.equal(verifyStripeSignature(payload, header, secret), true);
});

test('parseStripeSignature handles repeated v1 signatures', () => {
  const parsed = parseStripeSignature('t=1234, v1=aaa, v1=bbb, v0=ignored');
  assert.equal(parsed.timestamp, 1234);
  assert.deepEqual(parsed.v1Signatures, ['aaa', 'bbb']);
});

test('readRawBody decodes base64 payload', () => {
  const payload = '{"ok":true}';
  const event = { body: Buffer.from(payload, 'utf8').toString('base64'), isBase64Encoded: true };
  assert.equal(readRawBody(event).toString('utf8'), payload);
});
