const crypto = require('crypto');
const { sha256Hex, normalizeEmail, buildLicensePayload, signLicense, maskLicenseKey } = require('./lib/license');
const { getLicenseStore, saveFulfillment } = require('./lib/store');
const { sendLicenseEmail } = require('./lib/email');

function verifyStripeSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;

  const parts = Object.fromEntries(
    signature
      .split(',')
      .map((item) => item.split('='))
      .filter((entry) => entry.length === 2)
  );

  if (!parts.t || !parts.v1) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(parts.v1, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = event.body || '';

  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON payload' };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Event ignored' };
  }

  const session = stripeEvent.data?.object || {};
  const sessionId = session.id;
  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  if (!sessionId || !email) return { statusCode: 200, body: 'Missing session data' };

  const store = getLicenseStore();
  const existing = await store.get(`session:${sessionId}`, { type: 'json' });
  if (existing) return { statusCode: 200, body: 'Already fulfilled' };

  const payload = buildLicensePayload({ purchaserEmail: email, orderId: sessionId });
  const licenseKey = signLicense(payload);
  const record = {
    order_id: sessionId,
    session_id: sessionId,
    email_hash: sha256Hex(email),
    license_key: licenseKey,
    created_at: new Date().toISOString(),
    product: 'CoolAutoSorter'
  };

  await saveFulfillment(record);
  await sendLicenseEmail({ to: email, licenseKey, orderId: sessionId });

  console.info(`Fulfilled ${sessionId} for ${record.email_hash} key=${maskLicenseKey(licenseKey)}`);
  return { statusCode: 200, body: 'Fulfilled' };
};
