const crypto = require('crypto');
const { sha256Hex, buildLicensePayload, signLicense } = require('./lib/license');
const { saveFulfillment } = require('./lib/store');
const { sendLicenseEmail } = require('./lib/email');

function verifyStripeSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const fields = Object.fromEntries(signature.split(',').map((part) => part.split('=')));
  const timestamp = fields.t;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const signatures = signature.split(',').filter((item) => item.startsWith('v1=')).map((item) => item.slice(3));
  return signatures.some((value) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  });
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = event.body || '';

  if (!verifyStripeSignature(rawBody, signature, secret)) {
    return { statusCode: 400, body: 'Invalid signature' };
  }

  const stripeEvent = JSON.parse(rawBody);
  if (stripeEvent.type !== 'checkout.session.completed') return { statusCode: 200, body: 'Ignored' };

  const session = stripeEvent.data?.object;
  const email = session.customer_details?.email || session.customer_email;
  if (!email || !session.id) return { statusCode: 200, body: 'Missing data' };

  const payload = buildLicensePayload({ purchaserEmail: email, orderId: session.id });
  const licenseKey = signLicense(payload);
  const record = {
    checkout_session_id: session.id,
    email,
    email_hash: sha256Hex(email.toLowerCase()),
    created_at: new Date().toISOString(),
    license_key: licenseKey,
    product: 'CoolAutoSorter'
  };

  await saveFulfillment(record);
  await sendLicenseEmail({ to: email, licenseKey, orderId: session.id });

  return { statusCode: 200, body: 'Fulfilled' };
};
