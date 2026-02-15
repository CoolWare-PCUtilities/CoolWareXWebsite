async function consumeRateLimit({ store, key, windowMs, maxAttempts, now = Date.now() }) {
  const existing = (await store.get(key, { type: 'json' })) || { count: 0, startedAt: now };
  const withinWindow = now - Number(existing.startedAt || now) < windowMs;
  const next = {
    count: withinWindow ? Number(existing.count || 0) + 1 : 1,
    startedAt: withinWindow ? Number(existing.startedAt || now) : now
  };

  await store.set(key, JSON.stringify(next));
  const retryAfterSeconds = Math.max(1, Math.ceil((next.startedAt + windowMs - now) / 1000));
  return {
    allowed: next.count <= maxAttempts,
    count: next.count,
    retryAfterSeconds
  };
}

module.exports = { consumeRateLimit };
