const { signLicensePayload, getPublicKeyB64 } = require('./_lib/licenseSigning');
const { jsonResponse, getRequestId } = require('./lib/http');

function isAuthorized(event) {
  if (process.env.NODE_ENV !== 'production') return true;

  const expected = process.env.DEBUG_TOKEN;
  if (!expected) return false;

  const headerToken = event.headers['x-debug-token'] || event.headers['X-Debug-Token'];
  const queryToken = event.queryStringParameters?.debug_token;
  return headerToken === expected || queryToken === expected;
}

exports.handler = async function handler(event) {
  const requestId = getRequestId(event);

  if (!isAuthorized(event)) return jsonResponse(403, { error: 'Forbidden' }, requestId);

  const payload = {
    product: 'CoolAutoSorter',
    license_type: 'lifetime',
    issued_at: '2024-01-01T00:00:00.000Z',
    order_id: 'debug_order_123',
    purchaser_email_hash: 'debug_email_hash'
  };

  const exampleLicenseKey = signLicensePayload(payload);

  return jsonResponse(200, {
    derivedPublicKeyB64: getPublicKeyB64(),
    exampleLicenseKey
  }, requestId);
};
