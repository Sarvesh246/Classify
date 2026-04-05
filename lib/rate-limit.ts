import "server-only";

type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  key: string;
  retryAfterSeconds: number;
  remaining: number;
};

type CounterEntry = {
  count: number;
  resetAt: number;
};

const GLOBAL_KEY = "__classify_rate_limit_store__";

function getStore() {
  const globalState = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: Map<string, CounterEntry>;
  };

  if (!globalState[GLOBAL_KEY]) {
    globalState[GLOBAL_KEY] = new Map<string, CounterEntry>();
  }

  return globalState[GLOBAL_KEY]!;
}

function extractClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function pruneExpiredEntries(now: number) {
  const store = getStore();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function rateLimitRequest(
  request: Request,
  rule: RateLimitRule,
  extraScope?: string | null,
): RateLimitResult {
  const now = Date.now();
  pruneExpiredEntries(now);

  const ip = extractClientIp(request);
  const key = [rule.key, ip, extraScope ?? "global"].join(":");
  const store = getStore();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + rule.windowMs,
    });
    return {
      ok: true,
      key,
      retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
      remaining: Math.max(rule.limit - 1, 0),
    };
  }

  if (existing.count >= rule.limit) {
    return {
      ok: false,
      key,
      retryAfterSeconds: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
      remaining: 0,
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    ok: true,
    key,
    retryAfterSeconds: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
    remaining: Math.max(rule.limit - existing.count, 0),
  };
}
