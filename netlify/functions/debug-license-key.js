const { signLicensePayload, getPublicKeyB64 } = require('./_lib/licenseSigning');

function isAuthorized(event) {
  if (process.env.NODE_ENV !== 'production') return true;

  const expected = process.env.DEBUG_TOKEN;
  if (!expected) return false;

  const headerToken = event.headers['x-debug-token'] || event.headers['X-Debug-Token'];
  const queryToken = event.queryStringParameters?.debug_token;
  return headerToken === expected || queryToken === expected;
}

exports.handler = async function handler(event) {
  if (!isAuthorized(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };

  const payload = {
    product: 'CoolAutoSorter',
    license_type: 'lifetime',
    issued_at: '2024-01-01T00:00:00.000Z',
    order_id: 'debug_order_123',
    purchaser_email_hash: 'debug_email_hash'
  };

  const exampleLicenseKey = signLicensePayload(payload);

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      derivedPublicKeyB64: getPublicKeyB64(),
      exampleLicenseKey
    })
  };
};
