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

function getEnvValue(name: string): string | undefined {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  if (denoEnv?.get) {
    return denoEnv.get(name);
  }
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return nodeEnv?.[name];
}

function parseAllowedOrigins(): AllowedOrigins {
  const configured = getEnvValue("ALLOWED_ORIGINS");
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

type SupabaseAuthConfig = {
  supabaseUrl: string | null;
  anonKey: string | null;
};

type SupabaseUserFetchResult =
  | { ok: true; id: string; isAnonymous: boolean }
  | { ok: false; reason: "invalid_token" | "unavailable" };

let hasLoggedAuthConfigWarning = false;
let hasLoggedJwtFallbackWarning = false;
let hasLoggedJwtFallbackProductionWarning = false;

function getSupabaseUrl(): string | null {
  const raw = getEnvValue("SUPABASE_URL") || getEnvValue("SUPABASE_PROJECT_URL");
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function getSupabaseAnonKey(): string | null {
  return (
    getEnvValue("SUPABASE_ANON_KEY") ||
    getEnvValue("SUPABASE_PUBLISHABLE_KEY") ||
    getEnvValue("SUPABASE_KEY")
  );
}

function getSupabaseAuthConfig(): SupabaseAuthConfig {
  return {
    supabaseUrl: getSupabaseUrl(),
    anonKey: getSupabaseAnonKey(),
  };
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isProductionEnvironment(): boolean {
  if (getEnvValue("DENO_DEPLOYMENT_ID")) return true;

  const envValue = (
    getEnvValue("APP_ENV") ||
    getEnvValue("ENVIRONMENT") ||
    getEnvValue("NODE_ENV") ||
    ""
  )
    .trim()
    .toLowerCase();

  return envValue === "prod" || envValue === "production";
}

function allowUnverifiedJwtFallback(): boolean {
  if (!isTruthyEnv(getEnvValue("ALLOW_UNVERIFIED_JWT_FALLBACK"))) {
    return false;
  }

  if (!isProductionEnvironment()) {
    return true;
  }

  if (isTruthyEnv(getEnvValue("ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION"))) {
    return true;
  }

  if (!hasLoggedJwtFallbackProductionWarning) {
    hasLoggedJwtFallbackProductionWarning = true;
    console.error(
      "ALLOW_UNVERIFIED_JWT_FALLBACK is ignored in production by default. "
        + "Set ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION=true only for emergency recovery scenarios.",
    );
  }

  return false;
}

function numericClaim(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectBooleanFlag(source: unknown, key: string): boolean {
  if (!source || typeof source !== "object") return false;
  return (source as Record<string, unknown>)[key] === true;
}

function decodeUserFromJwt(token: string): { id: string; isAnonymous: boolean } | null {
  const claims = decodeJwtPayload(token.trim());
  if (!claims) return null;

  const subject = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!subject) return null;

  const exp = numericClaim(claims.exp);
  if (exp !== null && Date.now() >= exp * 1000) return null;

  const isAnonymous =
    claims.role === "anon" ||
    claims.is_anonymous === true ||
    objectBooleanFlag(claims.app_metadata, "is_anonymous") ||
    objectBooleanFlag(claims.user_metadata, "is_anonymous");

  return {
    id: subject,
    isAnonymous,
  };
}

function tryDecodeUserFromJwtFallback(
  bearerToken: string,
  reason: "missing_config" | "auth_unavailable",
): { id: string; isAnonymous: boolean } | null {
  if (!allowUnverifiedJwtFallback()) return null;
  const decodedUser = decodeUserFromJwt(bearerToken);
  if (!decodedUser) return null;

  if (!hasLoggedJwtFallbackWarning) {
    hasLoggedJwtFallbackWarning = true;
    console.warn(
      `ALLOW_UNVERIFIED_JWT_FALLBACK is enabled; accepting decoded JWT claims without signature verification (${reason}).`,
    );
  }

  return decodedUser;
}

async function fetchSupabaseUser(
  bearerToken: string,
  config: { supabaseUrl: string; anonKey: string },
): Promise<SupabaseUserFetchResult> {
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        apikey: config.anonKey,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "invalid_token" };
    }
    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }

    const data = (await response.json()) as {
      id?: string;
      is_anonymous?: boolean;
      app_metadata?: { is_anonymous?: boolean };
      user_metadata?: { is_anonymous?: boolean };
    };

    if (!data?.id) {
      return { ok: false, reason: "invalid_token" };
    }

    const isAnonymous =
      Boolean(data.is_anonymous) ||
      Boolean(data.app_metadata?.is_anonymous) ||
      Boolean(data.user_metadata?.is_anonymous);

    return { ok: true, id: data.id, isAnonymous };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function requireAuthenticatedUser(
  req: Request,
): Promise<{ ok: true; userId: string; isAnonymous: boolean } | { ok: false; status: number; error: string }> {
  const authConfig = getSupabaseAuthConfig();
  const anonKey = authConfig.anonKey;
  const isAnonKey = (value: string) =>
    anonKey ? value.trim() === anonKey.trim() : isProjectApiKeyLike(value);
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const apiKey = req.headers.get("apikey")?.trim() || "";
    if (isAnonKey(apiKey)) {
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
  const apiKey = req.headers.get("apikey")?.trim() || "";
  if (
    isAnonKey(bearerToken) ||
    (apiKey && apiKey === bearerToken && isAnonKey(apiKey))
  ) {
    return {
      ok: true,
      userId: "anon",
      isAnonymous: true,
    };
  }

  if (!authConfig.supabaseUrl || !authConfig.anonKey) {
    const fallbackUser = tryDecodeUserFromJwtFallback(bearerToken, "missing_config");
    if (fallbackUser) {
      return {
        ok: true,
        userId: fallbackUser.id,
        isAnonymous: fallbackUser.isAnonymous,
      };
    }

    if (!hasLoggedAuthConfigWarning) {
      hasLoggedAuthConfigWarning = true;
      console.error(
        "SUPABASE_URL and SUPABASE_ANON_KEY are required to validate bearer tokens. "
          + "Set those env vars or enable ALLOW_UNVERIFIED_JWT_FALLBACK for local development only.",
      );
    }

    return {
      ok: false,
      status: 503,
      error: "Authentication service is unavailable because Supabase auth is not configured.",
    };
  }

  const supabaseUser = await fetchSupabaseUser(bearerToken, {
    supabaseUrl: authConfig.supabaseUrl,
    anonKey: authConfig.anonKey,
  });
  if (supabaseUser.ok) {
    return {
      ok: true,
      userId: supabaseUser.id,
      isAnonymous: supabaseUser.isAnonymous,
    };
  }

  if (supabaseUser.reason === "unavailable") {
    const fallbackUser = tryDecodeUserFromJwtFallback(bearerToken, "auth_unavailable");
    if (fallbackUser) {
      return {
        ok: true,
        userId: fallbackUser.id,
        isAnonymous: fallbackUser.isAnonymous,
      };
    }

    return {
      ok: false,
      status: 503,
      error: "Authentication service is temporarily unavailable. Please try again.",
    };
  }

  return {
    ok: false,
    status: 401,
    error: "Invalid or expired Supabase session.",
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
