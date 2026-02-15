const { sha256Hex, normalizeEmail } = require('./lib/license');
const { getUpdatesStore, getRateLimitStore } = require('./lib/store');
const { isValidEmail } = require('./lib/validation');
const { consumeRateLimit } = require('./lib/rate-limit');
const { jsonResponse, getRequestId, getClientIp } = require('./lib/http');
const { logInfo, logError } = require('./lib/logging');

const WINDOW_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeProduct(value) {
  const raw = String(value || 'CoolAutoSorter').trim();
  if (!raw) return 'coolautosorter';
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'coolautosorter';
}

exports.handler = async function handler(event) {
  const requestId = getRequestId(event);

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, requestId);
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return jsonResponse(400, { error: 'Invalid request body' }, requestId);
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return jsonResponse(400, { error: 'Valid email required' }, requestId);
  }

  const ip = getClientIp(event);
  const product = normalizeProduct(body.product);

  try {
    const rateStore = getRateLimitStore();
    const rateKey = `updates:${sha256Hex(ip)}:${sha256Hex(email)}:${product}`;
    const rate = await consumeRateLimit({
      store: rateStore,
      key: rateKey,
      windowMs: WINDOW_MS,
      maxAttempts: MAX_ATTEMPTS
    });

    if (!rate.allowed) {
      return {
        ...jsonResponse(429, { error: 'Too many requests. Please try again later.' }, requestId),
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'retry-after': String(rate.retryAfterSeconds)
        }
      };
    }

    const store = getUpdatesStore();
    const key = `${product}:${sha256Hex(email)}`;
    await store.set(key, JSON.stringify({ product, email_hash: sha256Hex(email), created_at: new Date().toISOString() }));

    logInfo('updates subscription saved', { requestId, email, product, ipHash: sha256Hex(ip) });
    return jsonResponse(200, { ok: true }, requestId);
  } catch (error) {
    logError('updates subscription failed', { requestId, error: error.message, email, product, ipHash: sha256Hex(ip) });
    return jsonResponse(500, { error: 'Unable to process request.' }, requestId);
  }
};
