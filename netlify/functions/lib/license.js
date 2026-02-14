const { sha256Hex } = require('../_lib/licenseSigning');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function maskLicenseKey(licenseKey) {
  if (!licenseKey || typeof licenseKey !== 'string') return '[redacted]';
  if (licenseKey.length < 20) return `${licenseKey.slice(0, 4)}...`;
  return `${licenseKey.slice(0, 12)}...${licenseKey.slice(-8)}`;
}

module.exports = { sha256Hex, normalizeEmail, maskLicenseKey };
