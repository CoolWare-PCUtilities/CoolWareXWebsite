const { sha256Hex, normalizeEmail } = require('./lib/license');
const { getLicenseStore, getRateLimitStore } = require('./lib/store');

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const SAFE_MESSAGE = 'If a matching license exists, it has been returned.';

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const ip = (event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const email = normalizeEmail(body.email);

  const rateStore = getRateLimitStore();
  const rateKey = `lookup:${sha256Hex(ip)}`;
  const now = Date.now();
  const current = (await rateStore.get(rateKey, { type: 'json' })) || { count: 0, started_at: now };
  const withinWindow = now - current.started_at < WINDOW_MS;
  const next = { count: withinWindow ? current.count + 1 : 1, started_at: withinWindow ? current.started_at : now };
  await rateStore.set(rateKey, JSON.stringify(next));

  if (next.count > MAX_ATTEMPTS) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Request limit reached. Please try again later.' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 200, body: JSON.stringify({ found: false, licenses: [], message: SAFE_MESSAGE }) };
  }

  const store = getLicenseStore();
  const emailHash = sha256Hex(email);
  const list = await store.list({ prefix: `email:${emailHash}:` });
  const items = await Promise.all(list.blobs.map((blob) => store.get(blob.key, { type: 'json' })));
  const licenses = items
    .filter(Boolean)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 5);

  return {
    statusCode: 200,
    body: JSON.stringify({
      found: licenses.length > 0,
      licenses,
      message: SAFE_MESSAGE
    })
  };
};
