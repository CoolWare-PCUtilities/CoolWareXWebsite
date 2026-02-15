const test = require('node:test');
const assert = require('node:assert/strict');

const { markProcessedEvent } = require('../netlify/functions/lib/idempotency');

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

test('markProcessedEvent marks and detects duplicate events', async () => {
  const store = createMemoryStore();

  const first = await markProcessedEvent({ store, eventId: 'evt_123', payload: { type: 'checkout.session.completed' } });
  assert.equal(first.alreadyProcessed, false);

  const second = await markProcessedEvent({ store, eventId: 'evt_123', payload: { type: 'checkout.session.completed' } });
  assert.equal(second.alreadyProcessed, true);
  assert.equal(second.record.eventId, 'evt_123');
});
