const { sha256Hex, normalizeEmail } = require('./lib/license');
const { getLicenseStore, getRateLimitStore } = require('./lib/store');
const { jsonResponse, getRequestId, getClientIp } = require('./lib/http');
const { consumeRateLimit } = require('./lib/rate-limit');
const { isValidEmail } = require('./lib/validation');
const { sendLicenseEmail } = require('./lib/email');
const { logInfo, logError } = require('./lib/logging');

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const SAFE_MESSAGE = 'If a matching purchase exists, an email has been sent.';

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
    const ipRate = await consumeRateLimit({
      store: rateStore,
      key: `lookup:ip:${sha256Hex(ip)}`,
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxAttempts: RATE_LIMIT_MAX_ATTEMPTS
    });

    const emailHash = sha256Hex(email || 'empty');
    const emailRate = await consumeRateLimit({
      store: rateStore,
      key: `lookup:email:${emailHash}`,
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxAttempts: RATE_LIMIT_MAX_ATTEMPTS
    });

    if (!ipRate.allowed || !emailRate.allowed) {
      return jsonResponse(200, { ok: true, message: SAFE_MESSAGE }, requestId);
    }

    if (isValidEmail(email)) {
      const store = getLicenseStore();
      const list = await store.list({ prefix: `email:${sha256Hex(email)}:` });
      const blobs = Array.isArray(list?.blobs) ? list.blobs : [];
      const items = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })));

      const latestLicense = items
        .filter((item) => item?.license_key)
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];

      if (latestLicense) {
        await sendLicenseEmail({ to: email, licenseKey: latestLicense.license_key, orderId: latestLicense.order_id || 'lookup' });
      }
    }

    logInfo('license lookup completed', { requestId, ipHash: sha256Hex(ip), emailHash: sha256Hex(email || '') });
    return jsonResponse(200, { ok: true, message: SAFE_MESSAGE }, requestId);
  } catch (error) {
    logError('license lookup failed', { requestId, error: error.message, ipHash: sha256Hex(ip), emailHash: sha256Hex(email || '') });
    return jsonResponse(500, { error: 'Unable to process request.' }, requestId);
  }
};
