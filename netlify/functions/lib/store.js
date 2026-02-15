const { getStore } = require('@netlify/blobs');

function getLicenseStore() {
  return getStore('licenses');
}

function getRateLimitStore() {
  return getStore('rate_limits');
}

function getUpdatesStore() {
  return getStore('updates');
}

function getWebhookEventStore() {
  return getStore('webhook_events');
}

async function saveFulfillment(record) {
  const store = getLicenseStore();
  const sessionKey = `session:${record.session_id}`;
  const emailKey = `email:${record.email_hash}:${record.created_at}:${record.session_id}`;

  await store.set(sessionKey, JSON.stringify(record));
  await store.set(emailKey, JSON.stringify({
    order_id: record.order_id,
    product: record.product,
    created_at: record.created_at,
    license_key: record.license_key
  }));
}

module.exports = {
  getLicenseStore,
  getRateLimitStore,
  getUpdatesStore,
  getWebhookEventStore,
  saveFulfillment
};
