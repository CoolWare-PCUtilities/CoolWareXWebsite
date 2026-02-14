const crypto = require('crypto');

function base64Url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildLicensePayload({ purchaserEmail, orderId }) {
  return {
    product: 'CoolAutoSorter',
    license_type: 'lifetime',
    issued_at: new Date().toISOString(),
    purchaser_email: purchaserEmail,
    order_id: orderId
  };
}

function signLicense(payload) {
  const keyB64 = process.env.LICENSE_SIGNING_PRIVATE_KEY;
  if (!keyB64) throw new Error('Missing LICENSE_SIGNING_PRIVATE_KEY');

  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = base64Url(payloadJson);
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(keyB64, 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
  const signature = crypto.sign(null, Buffer.from(payloadJson), privateKey);
  return `COOLWAREX-${payloadEncoded}.${base64Url(signature)}`;
}

module.exports = { sha256Hex, buildLicensePayload, signLicense };
