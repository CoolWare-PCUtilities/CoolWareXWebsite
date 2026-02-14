const crypto = require('crypto');

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function maskLicenseKey(licenseKey) {
  if (!licenseKey || typeof licenseKey !== 'string') return '[redacted]';
  if (licenseKey.length < 20) return `${licenseKey.slice(0, 4)}...`;
  return `${licenseKey.slice(0, 12)}...${licenseKey.slice(-8)}`;
}

function buildLicensePayload({ purchaserEmail, orderId }) {
  return {
    product: 'CoolAutoSorter',
    license_type: 'lifetime',
    issued_at: new Date().toISOString(),
    order_id: orderId,
    purchaser_email_hash: sha256Hex(normalizeEmail(purchaserEmail))
  };
}

function signLicense(payload) {
  const keyB64 = process.env.LICENSE_SIGNING_PRIVATE_KEY_B64;
  if (!keyB64) throw new Error('Missing LICENSE_SIGNING_PRIVATE_KEY_B64');

  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = base64Url(payloadJson);
  const privateKeyRaw = Buffer.from(keyB64, 'base64');

  let privateKey;
  if (privateKeyRaw.length === 32) {
    privateKey = crypto.createPrivateKey({
      key: Buffer.concat([
        Buffer.from('302e020100300506032b657004220420', 'hex'),
        privateKeyRaw
      ]),
      format: 'der',
      type: 'pkcs8'
    });
  } else {
    privateKey = crypto.createPrivateKey({
      key: privateKeyRaw,
      format: 'der',
      type: 'pkcs8'
    });
  }

  const signature = crypto.sign(null, Buffer.from(payloadJson), privateKey);
  return `COOLWAREX-${payloadEncoded}.${base64Url(signature)}`;
}

module.exports = { sha256Hex, normalizeEmail, buildLicensePayload, signLicense, maskLicenseKey };
