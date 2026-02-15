const crypto = require('crypto');
const { sha256Hex, normalizeEmail, maskLicenseKey } = require('./lib/license');
const { signLicensePayload } = require('./_lib/licenseSigning');
const { getLicenseStore, getWebhookEventStore, saveFulfillment } = require('./lib/store');
const { sendLicenseEmail } = require('./lib/email');
const { getRequestId, jsonResponse } = require('./lib/http');
const { markProcessedEvent } = require('./lib/idempotency');
const { isValidEmail } = require('./lib/validation');
const { logInfo, logError } = require('./lib/logging');

const DEFAULT_TOLERANCE_SECONDS = 300;

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

exports.handler = async function handler(event) {
  const requestId = getRequestId(event);

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, requestId);
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
      emailHash: sha256Hex(email),
      licenseKey: maskLicenseKey(licenseKey)
    });
    return jsonResponse(200, { ok: true }, requestId);
  } catch (error) {
    logError('stripe webhook processing failed', { requestId, eventId, error: error.message });
    return jsonResponse(500, { error: 'Webhook processing failed' }, requestId);
  }
};

module.exports = { verifyStripeSignature, readRawBody, parseStripeSignature };
