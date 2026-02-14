const { getStore } = require('@netlify/blobs');

function getLicenseStore() {
  return getStore('licenses');
}

async function saveFulfillment(record) {
  const store = getLicenseStore();
  const sessionKey = `session:${record.checkout_session_id}`;
  const emailKey = `email:${record.email_hash}:${record.checkout_session_id}`;
  await store.set(sessionKey, JSON.stringify(record));
  await store.set(emailKey, JSON.stringify({
    order_id: record.checkout_session_id,
    license_key: record.license_key,
    created_at: record.created_at
  }));
}

module.exports = { getLicenseStore, saveFulfillment };
