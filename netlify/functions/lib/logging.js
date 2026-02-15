const { maskLicenseKey } = require('./license');

function maskEmail(email) {
  const text = String(email || '').trim().toLowerCase();
  if (!text || !text.includes('@')) return '[redacted-email]';
  const [local, domain] = text.split('@');
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function toLogContext(base) {
  const ctx = { ...base };
  if (ctx.email) ctx.email = maskEmail(ctx.email);
  if (ctx.licenseKey) ctx.licenseKey = maskLicenseKey(ctx.licenseKey);
  return ctx;
}

function logInfo(message, context = {}) {
  console.info(JSON.stringify({ level: 'info', message, ...toLogContext(context) }));
}

function logError(message, context = {}) {
  console.error(JSON.stringify({ level: 'error', message, ...toLogContext(context) }));
}

module.exports = { logInfo, logError, maskEmail };
