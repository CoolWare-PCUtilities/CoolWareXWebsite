const { getStore } = require('@netlify/blobs');

function createStore(name) {
  try {
    return getStore(name);
  } catch (error) {
    const guidance = [
      `Unable to initialize Netlify Blobs store "${name}".`,
      'For local development, run functions with Netlify CLI (`npm run dev`) so NETLIFY_* and BLOBS environment variables are injected.',
      'If running outside Netlify CLI/runtime, configure the required Netlify Blobs environment variables first.',
      `Original error: ${error.message}`
    ].join(' ');
    throw new Error(guidance);
  }
}

function getLicenseStore() {
  return createStore('licenses');
}

function getRateLimitStore() {
  return createStore('rate_limits');
}

function getUpdatesStore() {
  return createStore('updates');
}

function getWebhookEventStore() {
  return createStore('webhook_events');
}

async function saveFulfillment(record) {
  const store = getLicenseStore();
  const sessionKey = `session:${record.session_id}`;
  const emailKey = `email:${record.email_hash}:${record.created_at}:${record.session_id}`;

  await store.set(sessionKey, JSON.stringify(record));
  await store.set(
    emailKey,
    JSON.stringify({
      order_id: record.order_id,
      product: record.product,
      created_at: record.created_at,
      license_key: record.license_key
    })
  );
}

module.exports = {
  getLicenseStore,
  getRateLimitStore,
  getUpdatesStore,
  getWebhookEventStore,
  saveFulfillment
};
