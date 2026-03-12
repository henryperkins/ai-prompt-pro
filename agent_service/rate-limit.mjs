function createMemoryRateLimitBackend() {
  const stores = new Map();

  function getStore(scope) {
    const existing = stores.get(scope);
    if (existing) return existing;
    const created = new Map();
    stores.set(scope, created);
    return created;
  }

  function pruneStore(store, now) {
    for (const [key, state] of store.entries()) {
      if (state.resetAt <= now) {
        store.delete(key);
      }
    }
  }

  return {
    check(options) {
      const { scope, key, limit, windowMs } = options;
      const store = getStore(scope);
      const now = Date.now();

      if (store.size > 5000) {
        pruneStore(store, now);
      }

      const current = store.get(key);
      if (!current || current.resetAt <= now) {
        const resetAt = now + windowMs;
        store.set(key, { count: 1, resetAt });
        return { ok: true, remaining: Math.max(0, limit - 1), resetAt };
      }

      if (current.count >= limit) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
          resetAt: current.resetAt,
        };
      }

      current.count += 1;
      store.set(key, current);
      return { ok: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
    },
  };
}

export function createRateLimiter({ backend = "memory" } = {}) {
  if (backend !== "memory") {
    throw new Error(
      `Unsupported RATE_LIMIT_BACKEND "${backend}". Only "memory" is implemented in this service build.`,
    );
  }

  return {
    backend,
    ...createMemoryRateLimitBackend(),
  };
}
