# Authentication Review

Last updated: 2026-03-26

> Historical snapshot.
> Do not treat this file as current operational guidance; use `docs/README.md` to find active docs.

Date: 2026-03-26

## Executive Summary

The current Cloudflare auth migration is not production-ready yet.

The most serious issue is that password verification in the worker uses the wrong constant-time comparison API, which is likely to break email/password login entirely. Beyond that, the auth surface still lacks server-side brute-force protection, immediate access-token revocation, and a safe password-reset flow.

The browser-side auth helpers and related unit tests are in decent shape. I verified that `src/test/useAuth.sign-up.test.tsx` and `src/test/service-auth.test.ts` currently pass. The worker auth path itself does not have comparable coverage, which is why the worker-specific issues below were not caught.

## High Severity

### AUTH-001: Password verification uses a non-existent Workers API

- Severity: High
- Location: `workers/lib/auth.ts:50-86`
- Evidence:

```ts
const derivedHash = new Uint8Array(derivedBits);

// Constant-time comparison
return crypto.timingSafeEqual(storedHashBytes, derivedHash);
```

- Impact: On Cloudflare Workers, the supported Web Crypto API is `crypto.subtle.timingSafeEqual(...)`, not `crypto.timingSafeEqual(...)`. As written, password verification is likely to throw and fall into the `catch`, causing valid password logins to fail.
- Fix: Replace the comparison with `crypto.subtle.timingSafeEqual(storedHashBytes, derivedHash)` or use `timingSafeEqual` from `node:crypto` explicitly if the project intends to rely on Node compatibility APIs.
- Mitigation: Add a worker-focused auth test that exercises `verifyPassword()` and the `/auth/login` route in the actual Workers runtime.

### AUTH-002: Login and registration have no server-side brute-force protection

- Severity: High
- Location: `workers/auth/index.ts:29-168`, `src/components/AuthDialog.tsx:54-79`
- Evidence:

```ts
app.post("/register", async (c) => {
  const body = await c.req.json();
  const { email, password, displayName } = body;
```

```ts
app.post("/login", async (c) => {
  const body = await c.req.json();
  const { email, password } = body;
```

```ts
const loginThrottle =
  mode === "login"
    ? createPersistedAuthThrottle(normalizedEmail)
    : null;
```

- Impact: The only visible throttle is client-side. An attacker can bypass it trivially by calling the worker directly, enabling credential stuffing and password guessing against `/auth/login`, and abuse of `/auth/register` and future reset endpoints.
- Fix: Add server-side rate limiting keyed by IP and normalized email for `/login`, `/register`, `/refresh`, and `/reset-password`. Return the same generic auth errors regardless of whether the email exists.
- Mitigation: Until worker-side rate limiting exists, do not treat the current dialog throttle as meaningful security control.

### AUTH-003: Logout does not invalidate access tokens for API routes

- Severity: High
- Location: `workers/auth/index.ts:230-245`, `workers/api/index.ts:88-108`, `workers/auth/index.ts:251-320`
- Evidence:

```ts
await c.env.DB
  .prepare("UPDATE sessions SET revoked = 1 WHERE refresh_token_hash = ?")
  .bind(refreshTokenHash)
  .run();
```

```ts
const payload = await verifyToken(token, c.env.JWT_SECRET);
if (!payload || typeof payload !== "object") {
  c.set("userId", null);
  c.set("userEmail", null);
  return next();
}
```

- Impact: Logout revokes refresh tokens only. Any already-issued access token remains valid until `exp`, and `/api/*`, `/auth/session`, and `/auth/account` trust the JWT signature alone. If an access token is stolen, the attacker keeps authenticated access for up to 15 minutes after logout.
- Fix: Add immediate revocation semantics. Practical options:
  - include a per-session `jti` in access tokens and check revocation state on protected routes, or
  - include a user/session version in the JWT and reject tokens issued before the current version, or
  - keep access-token TTL extremely short and rotate aggressively, while still checking revocation for sensitive routes.
- Mitigation: If immediate revocation is not added yet, document logout as "refresh-token revocation only" and shorten access-token lifetime further.

## Medium Severity

### AUTH-004: The worker trusts frontend-only validation for passwords and profile fields

- Severity: Medium
- Location: `workers/auth/index.ts:29-35`, `workers/auth/index.ts:110-116`, `src/components/AuthDialog.tsx:194-220`
- Evidence:

```ts
if (!email || !password) {
  return c.json({ error: "Email and password required" }, 400);
}
```

```ts
<InputBase
  type={showPassword ? "text" : "password"}
  placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
  minLength={mode === "signup" ? 8 : undefined}
  autoComplete={mode === "login" ? "current-password" : "new-password"}
/>
```

- Impact: Password length, email normalization rules, and display-name safety are enforced in the browser but not at the worker boundary. Attackers can bypass the UI and create weak-password accounts or feed malformed values directly into auth endpoints.
- Fix: Validate and normalize on the worker for every auth endpoint. Enforce minimum password length, email shape and normalization, and display-name constraints server-side.
- Mitigation: Reuse the same validation rules on both sides, but treat the worker as the source of truth.

### AUTH-005: Email ownership is modeled in schema but not enforced

- Severity: Medium
- Location: `workers/d1/schema.sql:25-34`, `workers/auth/index.ts:54-104`, `workers/auth/index.ts:159-167`
- Evidence:

```sql
email_verified INTEGER NOT NULL DEFAULT 0,
```

```ts
return c.json({
  user: {
    id: userId,
    email: email.toLowerCase(),
    displayName,
  },
  accessToken,
  refreshToken,
}, 201);
```

- Impact: The schema suggests email-verification support, but registration immediately issues a full session and no route checks `email_verified`. That allows account creation for arbitrary email addresses and makes future password-reset behavior harder to reason about safely.
- Fix: Either remove `email_verified` until it exists for real, or implement it properly:
  - create email-verification tokens,
  - block sensitive flows until the address is verified, or
  - at minimum mark the account state clearly and keep password reset generic.
- Mitigation: If account verification is deferred, ensure password reset proves mailbox ownership before changing credentials.

### AUTH-006: Session tokens are stored in `localStorage`

- Severity: Medium
- Location: `src/lib/browser-auth.ts:41-84`, `src/lib/browser-auth.ts:144-248`
- Evidence:

```ts
const stored = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
```

```ts
window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, JSON.stringify(nextTokens));
```

- Impact: Any XSS in the frontend becomes durable account takeover because both access and refresh tokens are readable from JavaScript. This is a common SPA tradeoff, but it materially raises auth risk.
- Fix: Prefer an `HttpOnly`, `Secure`, `SameSite` cookie for the refresh token and keep the access token in memory only, or move fully to cookie-backed sessions.
- Mitigation: If localStorage remains, enforce a strong CSP, minimize dangerous sinks, and rotate refresh tokens on use.

## Password Reset Recommendation

The cleanest implementation for the current stack is:

1. Add a `password_reset_tokens` table in `workers/d1/schema.sql` with:
   - `id`
   - `user_id`
   - `token_hash`
   - `expires_at`
   - `consumed_at`
   - `created_at`
   - optional `requested_ip` / `requested_user_agent`
2. Keep raw reset tokens out of storage. Generate a random token, hash it with SHA-256, store only the hash, and email the raw token in a link.
3. Add `POST /auth/reset-password`:
   - normalize email
   - always return `202`
   - if the user exists, create a short-lived token and send email
   - rate limit by IP and email
4. Add `POST /auth/reset-password/confirm`:
   - accept `{ token, password }`
   - hash the token, load the matching row, reject expired/used tokens
   - hash the new password
   - update `users.password_hash`
   - mark the reset token as consumed
   - revoke every existing session for that user
5. Add a frontend route and form for the confirm step.
6. If email delivery is not configured yet, keep the endpoint truthful and return `501` instead of pretending reset succeeded.

## Order Of Operations

Recommended sequence:

1. Fix AUTH-001 so email/password login works reliably in Workers.
2. Add server-side validation and rate limiting before exposing password reset.
3. Implement password reset request + confirm.
4. Add immediate access-token revocation semantics so password reset can log out all existing sessions safely.
5. Decide whether to keep localStorage tokens or move refresh tokens into cookies.

## Verification Performed

- `npx vitest run src/test/useAuth.sign-up.test.tsx src/test/service-auth.test.ts`
- `npx tsc --noEmit`

Both commands passed in the current branch. They do not cover the worker auth defects above.
