const test = require('node:test');
const assert = require('node:assert/strict');

function loadLookupHandler({ licenses = [], ipAllowed = true, emailAllowed = true } = {}) {
  const modulePath = require.resolve('../netlify/functions/lookup-license');
  const storePath = require.resolve('../netlify/functions/lib/store');
  const ratePath = require.resolve('../netlify/functions/lib/rate-limit');
  const emailPath = require.resolve('../netlify/functions/lib/email');

  delete require.cache[modulePath];
  delete require.cache[storePath];
  delete require.cache[ratePath];
  delete require.cache[emailPath];

  let rateCall = 0;
  const sent = [];

  require.cache[storePath] = {
    exports: {
      getRateLimitStore() {
        return {};
      },
      getLicenseStore() {
        return {
          async list() {
            return { blobs: licenses.map((item, index) => ({ key: `k${index}` })) };
          },
          async get(key) {
            const index = Number(key.slice(1));
            return licenses[index];
          }
        };
      }
    }
  };

  require.cache[ratePath] = {
    exports: {
      async consumeRateLimit() {
        rateCall += 1;
        return { allowed: rateCall === 1 ? ipAllowed : emailAllowed, retryAfterSeconds: 10 };
      }
    }
  };

  require.cache[emailPath] = {
    exports: {
      async sendLicenseEmail(payload) {
        sent.push(payload);
      }
    }
  };

  const handler = require('../netlify/functions/lookup-license').handler;
  return { handler, sent };
}

test('lookup-license always returns generic message and never includes license key', async () => {
  const { handler } = loadLookupHandler({
    licenses: [{ order_id: 'ord_1', created_at: '2024-01-01T00:00:00.000Z', license_key: 'SECRET-KEY' }]
  });

  const response = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ email: 'a@b.com' }) });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.match(body.message, /If a matching purchase exists/i);
  assert.equal('license_key' in body, false);
});

test('lookup-license emails most recent key when matches exist', async () => {
  const { handler, sent } = loadLookupHandler({
    licenses: [
      { order_id: 'ord_old', created_at: '2024-01-01T00:00:00.000Z', license_key: 'OLD-KEY' },
      { order_id: 'ord_new', created_at: '2024-04-01T00:00:00.000Z', license_key: 'NEW-KEY' }
    ]
  });

  await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ email: 'a@b.com' }) });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].licenseKey, 'NEW-KEY');
  assert.equal(sent[0].orderId, 'ord_new');
});
