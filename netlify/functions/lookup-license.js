const { sha256Hex, normalizeEmail } = require('./lib/license');
const { getLicenseStore, getRateLimitStore } = require('./lib/store');
const { jsonResponse, getRequestId, getClientIp } = require('./lib/http');
const { consumeRateLimit } = require('./lib/rate-limit');
const { isValidEmail } = require('./lib/validation');
const { logInfo, logError } = require('./lib/logging');

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const SAFE_MESSAGE = 'If a matching license exists, it has been returned.';

exports.handler = async function handler(event) {
  const requestId = getRequestId(event);

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, requestId);
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return jsonResponse(400, { error: 'Invalid request body' }, requestId);
  }

  const ip = getClientIp(event);
  const email = normalizeEmail(body.email);

  try {
    const rateStore = getRateLimitStore();
    const rateKey = `lookup:${sha256Hex(ip)}:${sha256Hex(email || 'empty')}`;
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

    if (!isValidEmail(email)) {
      return jsonResponse(200, { found: false, licenses: [], message: SAFE_MESSAGE }, requestId);
    }

    const store = getLicenseStore();
    const emailHash = sha256Hex(email);
    const list = await store.list({ prefix: `email:${emailHash}:` });
    const blobs = Array.isArray(list?.blobs) ? list.blobs : [];
    const items = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })));

    const licenses = items
      .filter(Boolean)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 5);

    logInfo('license lookup completed', { requestId, ipHash: sha256Hex(ip), email });

    return jsonResponse(200, {
      found: licenses.length > 0,
      licenses,
      message: SAFE_MESSAGE
    }, requestId);
  } catch (error) {
    logError('license lookup failed', { requestId, error: error.message, ipHash: sha256Hex(ip), email });
    return jsonResponse(500, { error: 'Unable to process request.' }, requestId);
  }
};
