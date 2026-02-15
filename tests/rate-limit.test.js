const test = require('node:test');
const assert = require('node:assert/strict');

const { consumeRateLimit } = require('../netlify/functions/lib/rate-limit');

function createMemoryStore() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? JSON.parse(map.get(key)) : null;
    },
    async set(key, value) {
      map.set(key, String(value));
    }
  };
}

test('consumeRateLimit blocks after max attempts in same window', async () => {
  const store = createMemoryStore();
  const base = 1700000000000;

  const a = await consumeRateLimit({ store, key: 'k', windowMs: 60000, maxAttempts: 2, now: base });
  const b = await consumeRateLimit({ store, key: 'k', windowMs: 60000, maxAttempts: 2, now: base + 1000 });
  const c = await consumeRateLimit({ store, key: 'k', windowMs: 60000, maxAttempts: 2, now: base + 2000 });

  assert.equal(a.allowed, true);
  assert.equal(b.allowed, true);
  assert.equal(c.allowed, false);
  assert.ok(c.retryAfterSeconds >= 1);
});

test('consumeRateLimit resets after window passes', async () => {
  const store = createMemoryStore();
  const base = 1700000000000;

  await consumeRateLimit({ store, key: 'k', windowMs: 1000, maxAttempts: 1, now: base });
  const next = await consumeRateLimit({ store, key: 'k', windowMs: 1000, maxAttempts: 1, now: base + 1500 });
  assert.equal(next.allowed, true);
});
