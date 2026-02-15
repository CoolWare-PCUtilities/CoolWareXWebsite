async function markProcessedEvent({ store, eventId, payload }) {
  const key = `event:${eventId}`;
  const existing = await store.get(key, { type: 'json' });
  if (existing) {
    return { alreadyProcessed: true, record: existing };
  }

  const record = {
    eventId,
    processedAt: new Date().toISOString(),
    ...(payload || {})
  };
  await store.set(key, JSON.stringify(record));
  return { alreadyProcessed: false, record };
}

module.exports = { markProcessedEvent };
