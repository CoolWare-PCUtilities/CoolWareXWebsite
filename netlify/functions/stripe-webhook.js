const crypto = require('crypto');
const Stripe = require('stripe');

const { sha256Hex, normalizeEmail, maskLicenseKey } = require('./lib/license');
const { signLicensePayload } = require('./_lib/licenseSigning');
const { getLicenseStore, getWebhookEventStore, saveFulfillment } = require('./lib/store');
const { sendLicenseEmail } = require('./lib/email');
const { getRequestId, jsonResponse } = require('./lib/http');
const { markProcessedEvent } = require('./lib/idempotency');
const { isValidEmail } = require('./lib/validation');
const { logInfo, logError } = require('./lib/logging');

const DEFAULT_TOLERANCE_SECONDS = 300;

// Optional hardening / behavior controls
const DEFAULT_PRODUCT = 'CoolAutoSorter';
const DEFAULT_LICENSE_TYPE = 'lifetime';

function getHeaderValue(headers, name) {
  if (!headers || !name) return undefined;
  const target = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === target) return value;
  }
  return undefined;
}

function parseStripeSignature(signatureHeader) {
  if (!signatureHeader) return { timestamp: null, v1Signatures: [] };

  const parts = String(signatureHeader)
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean);

  let timestamp = null;
  const v1Signatures = [];

  for (const part of parts) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = part.slice(0, separatorIndex);
    const value = part.slice(separatorIndex + 1);

    if (key === 't') {
      timestamp = Number(value);
      continue;
    }

    if (key === 'v1' && value) {
      v1Signatures.push(value);
    }
  }

  return { timestamp, v1Signatures };
}

function verifyStripeSignature(rawBodyBuffer, signatureHeader, secret, toleranceSeconds = 300) {
  if (!signatureHeader || !secret || !Buffer.isBuffer(rawBodyBuffer)) return false;

  const { timestamp, v1Signatures } = parseStripeSignature(signatureHeader);
  if (!Number.isFinite(timestamp) || v1Signatures.length === 0) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBodyBuffer)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  return v1Signatures.some((candidate) => {
    try {
      const candidateBuffer = Buffer.from(candidate, 'hex');
      if (candidateBuffer.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
    } catch {
      return false;
    }
  });
}

function readRawBody(event) {
  if (typeof event?.body !== 'string') return Buffer.from('');
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body, 'utf8');
}

function buildStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  try {
    // Use Stripe SDK only if you set STRIPE_SECRET_KEY.
    // This is optional but strongly recommended for extra safety.
    return new Stripe(secretKey, { apiVersion: '2024-06-20' });
  } catch {
    return null;
  }
}

async function maybeFetchSessionFromStripe(stripe, sessionId) {
  if (!stripe || !sessionId) return null;
  try {
    // Expand customer_details for consistent email access.
    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'customer_details'],
    });
  } catch (e) {
    return null;
  }
}

function isPaidCheckoutSession(session) {
  // Stripe Checkout “completed” can still be unpaid in some async flows.
  // For one-time purchases you generally want payment_status === 'paid'.
  return session && session.payment_status === 'paid';
}

exports.handler = async function handler(event) {
  const requestId = getRequestId(event);

  // Optional: quick health response so you can test the endpoint in browser.
  if (event.httpMethod !== 'POST') {
    return jsonResponse(200, { ok: true, message: 'CoolAutoSorter webhook endpoint' }, requestId);
  }

  const signature = getHeaderValue(event.headers, 'stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const toleranceSeconds = Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS || DEFAULT_TOLERANCE_SECONDS);
  const rawBody = readRawBody(event);

  if (!verifyStripeSignature(rawBody, signature, webhookSecret, toleranceSeconds)) {
    logError('invalid stripe signature', { requestId });
    return jsonResponse(400, { error: 'Invalid signature' }, requestId);
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' }, requestId);
  }

  const eventId = stripeEvent?.id;
  const eventType = stripeEvent?.type;

  if (!eventId || !eventType) {
    return jsonResponse(400, { error: 'Missing event id/type' }, requestId);
  }

  try {
    // Idempotency at the event level (Stripe may retry deliveries)
    const eventStore = getWebhookEventStore();
    const processed = await markProcessedEvent({
      store: eventStore,
      eventId,
      payload: { type: eventType }
    });

    if (processed.alreadyProcessed) {
      logInfo('stripe event already processed', { requestId, eventId, type: eventType });
      return jsonResponse(200, { ok: true, duplicate: true }, requestId);
    }

    // We fulfill on checkout.session.completed (and optionally async success)
    // For async payment methods, you can also listen to checkout.session.async_payment_succeeded.
    if (eventType !== 'checkout.session.completed' && eventType !== 'checkout.session.async_payment_succeeded') {
      return jsonResponse(200, { ok: true, ignored: true }, requestId);
    }

    const sessionFromEvent = stripeEvent.data?.object || {};
    const sessionId = sessionFromEvent.id;

    if (!sessionId) {
      return jsonResponse(200, { ok: true, ignored: true, reason: 'Missing session id' }, requestId);
    }

    // Optional: verify session via Stripe API if STRIPE_SECRET_KEY is set.
    const stripe = buildStripeClient();
    const sessionVerified = await maybeFetchSessionFromStripe(stripe, sessionId);
    const session = sessionVerified || sessionFromEvent;

    // Require paid status before issuing a lifetime license.
    if (!isPaidCheckoutSession(session)) {
      logInfo('session not paid yet; ignoring', {
        requestId,
        eventId,
        sessionId,
        payment_status: session?.payment_status
      });
      return jsonResponse(200, { ok: true, ignored: true, reason: 'Payment not completed' }, requestId);
    }

    // Pull email (normalized)
    const email = normalizeEmail(session.customer_details?.email || session.customer_email);
    if (!isValidEmail(email)) {
      logInfo('missing/invalid email; ignoring', { requestId, eventId, sessionId });
      return jsonResponse(200, { ok: true, ignored: true, reason: 'Missing required email' }, requestId);
    }

    // Idempotency at the session/order level (if Stripe retries with different event IDs)
    const store = getLicenseStore();
    const existing = await store.get(`session:${sessionId}`, { type: 'json' });
    if (existing) {
      logInfo('session already fulfilled', { requestId, eventId, sessionId });
      return jsonResponse(200, { ok: true, duplicate: true }, requestId);
    }

    // Product metadata (optional)
    const product = process.env.LICENSE_PRODUCT || DEFAULT_PRODUCT;
    const licenseType = process.env.LICENSE_TYPE || DEFAULT_LICENSE_TYPE;

    // Generate offline-verifiable key (your signing system)
    const payload = {
      product,
      license_type: licenseType,
      issued_at: new Date().toISOString(),
      order_id: sessionId,
      purchaser_email_hash: sha256Hex(email),
      // Optional helpful fields (safe, non-PII):
      stripe_mode: session?.livemode ? 'live' : 'test',
      amount_total: session?.amount_total ?? null,
      currency: session?.currency ?? null,
    };

    const licenseKey = signLicensePayload(payload);

    const record = {
      order_id: sessionId,
      session_id: sessionId,
      email_hash: sha256Hex(email),
      license_key: licenseKey,
      created_at: new Date().toISOString(),
      product
    };

    await saveFulfillment(record);
    await sendLicenseEmail({ to: email, licenseKey, orderId: sessionId });

    logInfo('stripe event fulfilled', {
      requestId,
      eventId,
      sessionId,
      emailHash: sha256Hex(email),
      licenseKey: maskLicenseKey(licenseKey)
    });

    return jsonResponse(200, { ok: true }, requestId);
  } catch (error) {
    logError('stripe webhook processing failed', { requestId, eventId, error: error?.message || String(error) });
    return jsonResponse(500, { error: 'Webhook processing failed' }, requestId);
  }
};

module.exports = { verifyStripeSignature, readRawBody, parseStripeSignature };
