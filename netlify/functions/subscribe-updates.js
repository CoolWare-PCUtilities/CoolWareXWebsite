const { sha256Hex, normalizeEmail } = require('./lib/license');
const { getUpdatesStore } = require('./lib/store');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const email = normalizeEmail(body.email);
  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid email required' }) };
  }

  const store = getUpdatesStore();
  const key = `coolclipboard:${sha256Hex(email)}`;
  await store.set(key, JSON.stringify({ email_hash: sha256Hex(email), created_at: new Date().toISOString() }));

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
