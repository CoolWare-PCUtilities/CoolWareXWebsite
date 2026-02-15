const crypto = require('crypto');
const { sha256Hex, normalizeEmail, maskLicenseKey } = require('./lib/license');
const { signLicensePayload } = require('./_lib/licenseSigning');
const { getLicenseStore, getWebhookEventStore, saveFulfillment } = require('./lib/store');
const { sendLicenseEmail } = require('./lib/email');
const { getRequestId, jsonResponse } = require('./lib/http');
const { markProcessedEvent } = require('./lib/idempotency');
const { isValidEmail } = require('./lib/validation');
const { logInfo, logError } = require('./lib/logging');

function verifyStripeSignature(rawBody, signature, secret, toleranceSeconds = 300) {
  if (!signature || !secret) return false;

  const pieces = signature.split(',').map((item) => item.trim());
  const timestamp = pieces.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = pieces.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampNumber) > toleranceSeconds) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return signatures.some((candidate) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  });
}

function readRawBody(event) {
  if (!event?.body) return '';
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
}

exports.handler = async function handler(event) {
  const requestId = getRequestId(event);

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, requestId);
  }

  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = readRawBody(event);

  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    logError('invalid stripe signature', { requestId });
    return jsonResponse(400, { error: 'Invalid signature' }, requestId);
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' }, requestId);
  }

  const eventId = stripeEvent?.id;
  if (!eventId) {
    return jsonResponse(400, { error: 'Missing event id' }, requestId);
  }

  try {
    const eventStore = getWebhookEventStore();
    const processed = await markProcessedEvent({
      store: eventStore,
      eventId,
      payload: { type: stripeEvent.type }
    });

    if (processed.alreadyProcessed) {
      logInfo('stripe event already processed', { requestId, eventId, type: stripeEvent.type });
      return jsonResponse(200, { ok: true, duplicate: true }, requestId);
    }

    if (stripeEvent.type !== 'checkout.session.completed') {
      return jsonResponse(200, { ok: true, ignored: true }, requestId);
    }

    const session = stripeEvent.data?.object || {};
    const sessionId = session.id;
    const email = normalizeEmail(session.customer_details?.email || session.customer_email);
    if (!sessionId || !isValidEmail(email)) {
      return jsonResponse(200, { ok: true, ignored: true, reason: 'Missing required session fields' }, requestId);
    }

    const store = getLicenseStore();
    const existing = await store.get(`session:${sessionId}`, { type: 'json' });
    if (existing) {
      return jsonResponse(200, { ok: true, duplicate: true }, requestId);
    }

    const payload = {
      product: 'CoolAutoSorter',
      license_type: 'lifetime',
      issued_at: new Date().toISOString(),
      order_id: sessionId,
      purchaser_email_hash: sha256Hex(email)
    };
    const licenseKey = signLicensePayload(payload);
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

    logInfo('stripe event fulfilled', {
      requestId,
      eventId,
      sessionId,
      email,
      licenseKey: maskLicenseKey(licenseKey)
    });
    return jsonResponse(200, { ok: true }, requestId);
  } catch (error) {
    logError('stripe webhook processing failed', { requestId, eventId, error: error.message });
    return jsonResponse(500, { error: 'Webhook processing failed' }, requestId);
  }
};

module.exports = { verifyStripeSignature, readRawBody };
