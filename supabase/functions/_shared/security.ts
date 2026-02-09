type RateState = {
  count: number;
  resetAt: number;
};

type RateLimitOk = { ok: true; remaining: number; resetAt: number };
type RateLimitFail = { ok: false; retryAfterSeconds: number; resetAt: number };
type RateLimitResult = RateLimitOk | RateLimitFail;

const rateLimitStores = new Map<string, Map<string, RateState>>();

type AllowedOrigins =
  | { mode: "any" }
  | { mode: "set"; origins: Set<string> };

function parseAllowedOrigins(): AllowedOrigins {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured || !configured.trim()) {
    return { mode: "any" };
  }

  const raw = configured.trim();
  if (raw === "*" || raw.toLowerCase() === "any") {
    return { mode: "any" };
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return { mode: "any" };
  }

  return { mode: "set", origins: new Set(origins) };
}

const allowedOrigins = parseAllowedOrigins();

function baseCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function resolveCors(req: Request):
  | { ok: true; headers: Record<string, string>; origin: string }
  | { ok: false; headers: Record<string, string>; status: number; error: string } {
  const origin = req.headers.get("origin")?.trim();
  if (!origin) {
    return {
      ok: true,
      headers: baseCorsHeaders("null"),
      origin: "null",
    };
  }

  if (allowedOrigins.mode === "set" && !allowedOrigins.origins.has(origin)) {
    return {
      ok: false,
      headers: baseCorsHeaders("null"),
      status: 403,
      error: "Origin is not allowed.",
    };
  }

  return {
    ok: true,
    headers: baseCorsHeaders(origin),
    origin,
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "=");
    const decoded = atob(payload);
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isPublishableKeyLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("sb_publishable_");
}

function isLegacyAnonJwt(value: string): boolean {
  const claims = decodeJwtPayload(value.trim());
  if (!claims) return false;
  return claims.role === "anon";
}

function isProjectApiKeyLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return isPublishableKeyLike(trimmed) || isLegacyAnonJwt(trimmed);
}

export function requireAuthenticatedUser(req: Request):
  | { ok: true; userId: string; isAnonymous: boolean }
  | { ok: false; status: number; error: string } {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const apiKey = req.headers.get("apikey")?.trim() || "";
    if (isProjectApiKeyLike(apiKey)) {
      return {
        ok: true,
        userId: "anon",
        isAnonymous: true,
      };
    }
    return {
      ok: false,
      status: 401,
      error: "Missing bearer token.",
    };
  }

  const bearerToken = match[1].trim();
  const claims = decodeJwtPayload(bearerToken);
  if (!claims) {
    const apiKey = req.headers.get("apikey")?.trim() || "";
    if (apiKey && apiKey === bearerToken && isProjectApiKeyLike(apiKey)) {
      return {
        ok: true,
        userId: "anon",
        isAnonymous: true,
      };
    }
    return {
      ok: false,
      status: 401,
      error: "Invalid bearer token.",
    };
  }

  const role = typeof claims.role === "string" ? claims.role : "";
  const sub = typeof claims.sub === "string" ? claims.sub : "";
  if (role === "authenticated" && sub) {
    return {
      ok: true,
      userId: sub,
      isAnonymous: false,
    };
  }

  // Allow requests signed with the project publishable key (role=anon).
  // This keeps AI features available when anonymous auth sign-ins are disabled.
  if (role === "anon") {
    return {
      ok: true,
      userId: "anon",
      isAnonymous: true,
    };
  }

  return {
    ok: false,
    status: 401,
    error: "Authenticated Supabase session is required.",
  };
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstHop] = forwardedFor.split(",");
    if (firstHop?.trim()) return firstHop.trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return "unknown";
}

function getStore(scope: string): Map<string, RateState> {
  const existing = rateLimitStores.get(scope);
  if (existing) return existing;
  const created = new Map<string, RateState>();
  rateLimitStores.set(scope, created);
  return created;
}

function pruneStore(store: Map<string, RateState>, now: number): void {
  for (const [key, state] of store.entries()) {
    if (state.resetAt <= now) {
      store.delete(key);
    }
  }
}

function applyRateLimitMemory(options: {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const { scope, key, limit, windowMs } = options;
  const store = getStore(scope);
  const now = Date.now();

  if (store.size > 5000) {
    pruneStore(store, now);
  }

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      resetAt: now + windowMs,
    };
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
  return {
    ok: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

type DenoKv = Deno.Kv;
type DenoKvEntry<T> = Deno.KvEntryMaybe<T>;

let kvPromise: Promise<DenoKv | null> | null = null;

async function getKv(): Promise<DenoKv | null> {
  if (!kvPromise) {
    kvPromise = (async () => {
      const openKv = (Deno as typeof Deno & { openKv?: () => Promise<DenoKv> }).openKv;
      if (typeof openKv !== "function") return null;
      try {
        return await openKv();
      } catch {
        return null;
      }
    })();
  }

  return kvPromise;
}

async function applyRateLimitKv(
  kv: DenoKv,
  options: {
    scope: string;
    key: string;
    limit: number;
    windowMs: number;
  },
): Promise<RateLimitResult> {
  const { scope, key, limit, windowMs } = options;
  const now = Date.now();
  const bucketStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = bucketStart + windowMs;
  const expiryMs = Math.max(1, resetAt - now);
  const kvKey = ["rate-limit", scope, key, bucketStart] as const;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await kv.get<number>(kvKey);
    const count = typeof current.value === "number" ? current.value : 0;

    if (count >= limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        resetAt,
      };
    }

    const next = count + 1;
    const atomic = kv.atomic();
    if (current.versionstamp) {
      atomic.check(current as DenoKvEntry<number>);
    } else {
      atomic.check({ key: kvKey, versionstamp: null });
    }
    atomic.set(kvKey, next, { expireIn: expiryMs });

    const commit = await atomic.commit();
    if (commit.ok) {
      return {
        ok: true,
        remaining: Math.max(0, limit - next),
        resetAt,
      };
    }
  }

  return applyRateLimitMemory(options);
}

export async function applyRateLimit(options: {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const kv = await getKv();
  if (kv) {
    return applyRateLimitKv(kv, options);
  }
  return applyRateLimitMemory(options);
}
