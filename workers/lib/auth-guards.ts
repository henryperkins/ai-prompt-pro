const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DISPLAY_NAME_MAX_LENGTH = 32;
const DISPLAY_NAME_HIDDEN_OR_CONTROL_CODE_POINTS = new Set([
  0x00ad,
  0x034f,
  0x061c,
  0x115f,
  0x1160,
  0x17b4,
  0x17b5,
  0x180e,
  0x200b,
  0x200c,
  0x200d,
  0x200e,
  0x200f,
  0x202a,
  0x202b,
  0x202c,
  0x202d,
  0x202e,
  0x2060,
  0x2066,
  0x2067,
  0x2068,
  0x2069,
  0x3164,
  0xfeff,
]);

const RATE_LIMIT_PREFIX = "auth-rate";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function containsHiddenOrControlDisplayNameChar(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (typeof codePoint !== "number") continue;

    if (
      (codePoint >= 0x0000 && codePoint <= 0x001f)
      || (codePoint >= 0x007f && codePoint <= 0x009f)
      || DISPLAY_NAME_HIDDEN_OR_CONTROL_CODE_POINTS.has(codePoint)
    ) {
      return true;
    }
  }

  return false;
}

function buildRateLimitKey(scope: string): string {
  return `${RATE_LIMIT_PREFIX}:${scope}`;
}

async function readRateLimitRecord(kv: KVNamespace, key: string): Promise<RateLimitRecord | null> {
  const raw = await kv.get(buildRateLimitKey(key));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<RateLimitRecord>;
    if (
      typeof parsed.count === "number"
      && Number.isFinite(parsed.count)
      && typeof parsed.resetAt === "number"
      && Number.isFinite(parsed.resetAt)
    ) {
      return {
        count: parsed.count,
        resetAt: parsed.resetAt,
      };
    }
  } catch {
    // Ignore malformed KV payloads and start a fresh window.
  }

  return null;
}

async function writeRateLimitRecord(
  kv: KVNamespace,
  key: string,
  record: RateLimitRecord,
  ttlSeconds: number,
): Promise<void> {
  await kv.put(buildRateLimitKey(key), JSON.stringify(record), {
    expirationTtl: Math.max(60, ttlSeconds),
  });
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | null {
  if (!value) return "Enter a valid email address.";
  if (value.length > 320 || !EMAIL_PATTERN.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") return "";
  return normalizeWhitespace(value);
}

export function validateDisplayName(value: string): string | null {
  if (!value) return null;
  if (containsHiddenOrControlDisplayNameChar(value)) {
    return "Display name cannot include hidden or control characters.";
  }
  if (Array.from(value).length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string" || !value.length) {
    return "Password is required.";
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  return null;
}

export function resolveClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export async function peekRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
): Promise<RateLimitDecision> {
  const record = await readRateLimitRecord(kv, key);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!record || record.resetAt <= nowSeconds || record.count <= limit) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, record.resetAt - nowSeconds),
  };
}

export async function recordRateLimitHit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitDecision> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const existing = await readRateLimitRecord(kv, key);

  const record = !existing || existing.resetAt <= nowSeconds
    ? {
      count: 1,
      resetAt: nowSeconds + windowSeconds,
    }
    : {
      count: existing.count + 1,
      resetAt: existing.resetAt,
    };

  await writeRateLimitRecord(kv, key, record, record.resetAt - nowSeconds);

  if (record.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, record.resetAt - nowSeconds),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export async function clearRateLimit(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(buildRateLimitKey(key));
}
