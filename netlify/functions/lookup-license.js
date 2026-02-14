const { sha256Hex } = require('./lib/license');
const { getLicenseStore } = require('./lib/store');

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const body = event.body ? JSON.parse(event.body) : {};
  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };

  const store = getLicenseStore();
  const limiterKey = `ratelimit:${sha256Hex(`${ip}:${email}`)}`;
  const now = Date.now();
  const limiter = await store.get(limiterKey, { type: 'json' }) || { count: 0, started_at: now };
  const withinWindow = now - limiter.started_at < WINDOW_MS;
  const count = withinWindow ? limiter.count + 1 : 1;
  const startedAt = withinWindow ? limiter.started_at : now;
  await store.set(limiterKey, JSON.stringify({ count, started_at: startedAt }));

  if (count > MAX_ATTEMPTS) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Too many requests. Please try later.' }) };
  }

  const emailHash = sha256Hex(email);
  const list = await store.list({ prefix: `email:${emailHash}:` });
  const items = await Promise.all(list.blobs.map(async (blob) => store.get(blob.key, { type: 'json' })));

  return {
    statusCode: 200,
    body: JSON.stringify({
      found: items.length > 0,
      licenses: items.filter(Boolean)
    })
  };
};
