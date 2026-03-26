/**
 * PromptForge Auth Worker
 * Authentication service with JWT, email/password, and OAuth
 */

import { Hono, type Context } from "hono";
import {
  generateJwt,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  hashToken,
} from "../lib/auth";
import {
  clearRateLimit,
  normalizeDisplayName,
  normalizeEmail,
  peekRateLimit,
  recordRateLimitHit,
  resolveClientIp,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "../lib/auth-guards";

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
  PASSWORD_RESET_DELIVERY_WEBHOOK_URL?: string;
  PASSWORD_RESET_DELIVERY_WEBHOOK_TOKEN?: string;
  PASSWORD_RESET_PUBLIC_ORIGIN?: string;
};

type Variables = {
  userId: string | null;
};

type AuthContext = Context<{ Bindings: Bindings; Variables: Variables }>;

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const RESET_TOKEN_TTL_SECONDS = 60 * 60;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60;
const LOGIN_BURST_LIMIT = 20;
const LOGIN_BURST_WINDOW_SECONDS = 5 * 60;
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_SECONDS = 60 * 60;
const REFRESH_LIMIT = 60;
const REFRESH_WINDOW_SECONDS = 10 * 60;
const RESET_REQUEST_LIMIT = 3;
const RESET_REQUEST_WINDOW_SECONDS = 60 * 60;
const RESET_CONFIRM_LIMIT = 10;
const RESET_CONFIRM_WINDOW_SECONDS = 60 * 60;

function rateLimitResponse(c: AuthContext, retryAfterSeconds: number) {
  c.header("Retry-After", String(retryAfterSeconds));
  return c.json({
    error: `Too many attempts. Try again in ${retryAfterSeconds}s.`,
  }, 429);
}

function isPasswordResetEnabled(c: AuthContext): boolean {
  return Boolean(c.env.PASSWORD_RESET_DELIVERY_WEBHOOK_URL?.trim());
}

function resolvePasswordResetOrigin(c: AuthContext): string {
  const explicitOrigin = c.env.PASSWORD_RESET_PUBLIC_ORIGIN?.trim();
  if (explicitOrigin) {
    return explicitOrigin.replace(/\/+$/, "");
  }

  const requestOrigin = c.req.header("origin")?.trim();
  if (requestOrigin) {
    return requestOrigin.replace(/\/+$/, "");
  }

  return new URL(c.req.url).origin.replace(/\/+$/, "");
}

async function cleanupExpiredResetTokens(db: D1Database, nowSeconds: number): Promise<void> {
  await db
    .prepare("DELETE FROM password_reset_tokens WHERE consumed_at IS NOT NULL OR expires_at <= ?")
    .bind(nowSeconds)
    .run();
}

async function deliverPasswordResetWebhook(input: {
  webhookUrl: string;
  webhookToken?: string;
  email: string;
  resetUrl: string;
}): Promise<boolean> {
  const response = await fetch(input.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.webhookToken ? { Authorization: `Bearer ${input.webhookToken}` } : {}),
    },
    body: JSON.stringify({
      type: "password_reset",
      email: input.email,
      reset_url: input.resetUrl,
      app_name: "PromptForge",
    }),
  }).catch(() => null);

  return Boolean(response?.ok);
}

function loginFailureRateLimitKey(email: string, clientIp: string): string {
  return `login-failure:${email}:${clientIp}`;
}

function perIpRateLimitKey(scope: string, clientIp: string): string {
  return `${scope}:ip:${clientIp}`;
}

function perEmailRateLimitKey(scope: string, email: string): string {
  return `${scope}:email:${email}`;
}

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

app.get("/capabilities", (c) => {
  return c.json({
    oauthProviders: [],
    passwordResetEnabled: isPasswordResetEnabled(c),
    passwordResetSupportUrl: "/contact",
  });
});

// ============================================================
// Registration
// ============================================================
app.post("/register", async (c) => {
  const body = await c.req.json();
  const email = normalizeEmail(body.email);
  const password = body.password;
  const displayName = normalizeDisplayName(body.displayName);
  const clientIp = resolveClientIp(c.req.raw);

  const emailError = validateEmail(email);
  if (emailError) {
    return c.json({ error: emailError }, 400);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return c.json({ error: passwordError }, 400);
  }

  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) {
    return c.json({ error: displayNameError }, 400);
  }

  const ipRateLimit = await recordRateLimitHit(
    c.env.SESSIONS,
    perIpRateLimitKey("register", clientIp),
    REGISTER_LIMIT,
    REGISTER_WINDOW_SECONDS,
  );
  if (!ipRateLimit.allowed) {
    return rateLimitResponse(c, ipRateLimit.retryAfterSeconds);
  }

  const emailRateLimit = await recordRateLimitHit(
    c.env.SESSIONS,
    perEmailRateLimitKey("register", email),
    REGISTER_LIMIT,
    REGISTER_WINDOW_SECONDS,
  );
  if (!emailRateLimit.allowed) {
    return rateLimitResponse(c, emailRateLimit.retryAfterSeconds);
  }

  // Check if user exists
  const existing = await c.env.DB
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();

  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const userId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB
    .prepare(
      `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, email, passwordHash, displayName || null, now, now)
    .run();

  // Create profile
  await c.env.DB
    .prepare(
      `INSERT INTO profiles (id, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(userId, displayName || null, now, now)
    .run();

  // Generate tokens
  const accessToken = await generateJwt(
    { sub: userId, email },
    c.env.JWT_SECRET,
    60 * 15 // 15 minutes
  );

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashToken(refreshToken);
  const expiresAt = now + (60 * 60 * 24 * 7); // 7 days

  // Store refresh token
  await c.env.DB
    .prepare(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, refreshTokenHash, expiresAt, now)
    .run();

  // Store session in KV for fast lookup
  await c.env.SESSIONS.put(`session:${refreshToken}`, userId, {
    expirationTtl: 60 * 60 * 24 * 7,
  });

  return c.json({
    user: {
      id: userId,
      email,
      displayName: displayName || null,
    },
    accessToken,
    refreshToken,
  }, 201);
});

// ============================================================
// Login
// ============================================================
app.post("/login", async (c) => {
  const body = await c.req.json();
  const email = normalizeEmail(body.email);
  const password = body.password;
  const clientIp = resolveClientIp(c.req.raw);

  const emailError = validateEmail(email);
  if (emailError) {
    return c.json({ error: emailError }, 400);
  }

  if (typeof password !== "string" || !password) {
    return c.json({ error: "Email and password required" }, 400);
  }

  const burstRateLimit = await recordRateLimitHit(
    c.env.SESSIONS,
    perIpRateLimitKey("login-burst", clientIp),
    LOGIN_BURST_LIMIT,
    LOGIN_BURST_WINDOW_SECONDS,
  );
  if (!burstRateLimit.allowed) {
    return rateLimitResponse(c, burstRateLimit.retryAfterSeconds);
  }

  const failureKey = loginFailureRateLimitKey(email, clientIp);
  const loginFailureLimit = await peekRateLimit(
    c.env.SESSIONS,
    failureKey,
    LOGIN_FAILURE_LIMIT,
  );
  if (!loginFailureLimit.allowed) {
    return rateLimitResponse(c, loginFailureLimit.retryAfterSeconds);
  }

  // Get user
  const user = await c.env.DB
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first();

  if (!user) {
    const failureDecision = await recordRateLimitHit(
      c.env.SESSIONS,
      failureKey,
      LOGIN_FAILURE_LIMIT,
      LOGIN_FAILURE_WINDOW_SECONDS,
    );
    if (!failureDecision.allowed) {
      return rateLimitResponse(c, failureDecision.retryAfterSeconds);
    }
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const failureDecision = await recordRateLimitHit(
      c.env.SESSIONS,
      failureKey,
      LOGIN_FAILURE_LIMIT,
      LOGIN_FAILURE_WINDOW_SECONDS,
    );
    if (!failureDecision.allowed) {
      return rateLimitResponse(c, failureDecision.retryAfterSeconds);
    }
    return c.json({ error: "Invalid email or password" }, 401);
  }

  await clearRateLimit(c.env.SESSIONS, failureKey);

  // Generate tokens
  const accessToken = await generateJwt(
    { sub: user.id, email: user.email },
    c.env.JWT_SECRET,
    60 * 15 // 15 minutes
  );

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashToken(refreshToken);
  const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // 7 days

  // Store refresh token
  await c.env.DB
    .prepare(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), user.id, refreshTokenHash, expiresAt, Math.floor(Date.now() / 1000))
    .run();

  // Store session in KV
  await c.env.SESSIONS.put(`session:${refreshToken}`, user.id, {
    expirationTtl: 60 * 60 * 24 * 7,
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
    },
    accessToken,
    refreshToken,
  });
});

// ============================================================
// Token Refresh
// ============================================================
app.post("/refresh", async (c) => {
  const body = await c.req.json();
  const { refreshToken } = body;
  const clientIp = resolveClientIp(c.req.raw);

  if (!refreshToken) {
    return c.json({ error: "Refresh token required" }, 400);
  }

  const refreshRateLimit = await recordRateLimitHit(
    c.env.SESSIONS,
    perIpRateLimitKey("refresh", clientIp),
    REFRESH_LIMIT,
    REFRESH_WINDOW_SECONDS,
  );
  if (!refreshRateLimit.allowed) {
    return rateLimitResponse(c, refreshRateLimit.retryAfterSeconds);
  }

  // Lookup session in KV first
  const userId = await c.env.SESSIONS.get(`session:${refreshToken}`);
  if (!userId) {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  // Verify refresh token hash in DB
  const refreshTokenHash = await hashToken(refreshToken);
  const session = await c.env.DB
    .prepare("SELECT * FROM sessions WHERE refresh_token_hash = ? AND revoked = 0")
    .bind(refreshTokenHash)
    .first();

  if (!session) {
    await c.env.SESSIONS.delete(`session:${refreshToken}`);
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at < now) {
    await c.env.SESSIONS.delete(`session:${refreshToken}`);
    return c.json({ error: "Refresh token expired" }, 401);
  }

  // Get user for new token
  const effectiveUserId = typeof session.user_id === "string" ? session.user_id : userId;
  const user = await c.env.DB
    .prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(effectiveUserId)
    .first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Generate new access token
  const newAccessToken = await generateJwt(
    { sub: user.id, email: user.email },
    c.env.JWT_SECRET,
    60 * 15 // 15 minutes
  );

  return c.json({
    accessToken: newAccessToken,
  });
});

// ============================================================
// Logout
// ============================================================
app.post("/logout", async (c) => {
  const body = await c.req.json();
  const { refreshToken } = body;

  if (refreshToken) {
    // Revoke session
    const refreshTokenHash = await hashToken(refreshToken);
    await c.env.DB
      .prepare("UPDATE sessions SET revoked = 1 WHERE refresh_token_hash = ?")
      .bind(refreshTokenHash)
      .run();

    await c.env.SESSIONS.delete(`session:${refreshToken}`);
  }

  return c.json({ success: true });
});

// ============================================================
// Session Validation
// ============================================================
app.get("/session", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ authenticated: false }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || typeof payload !== "object") {
    return c.json({ authenticated: false }, 401);
  }

  const userId = (payload as Record<string, unknown>).sub as string;
  const user = await c.env.DB
    .prepare(
      `SELECT
         u.id,
         u.email,
         COALESCE(p.display_name, u.display_name) AS display_name,
         COALESCE(p.avatar_url, u.avatar_url) AS avatar_url
       FROM users u
       LEFT JOIN profiles p
         ON p.id = u.id
       WHERE u.id = ?`
    )
    .bind(userId)
    .first();

  if (!user) {
    return c.json({ authenticated: false }, 404);
  }

  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
  });
});

// ============================================================
// Account Deletion
// ============================================================
app.delete("/account", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || typeof payload !== "object") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = (payload as Record<string, unknown>).sub as string;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await c.env.DB.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?").bind(userId).run();
  await c.env.DB.prepare("DELETE FROM profiles WHERE id = ?").bind(userId).run();
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

  return c.json({ deleted: true });
});

// ============================================================
// Password Reset (Request)
// ============================================================
app.post("/reset-password", async (c) => {
  const body = await c.req.json();
  const email = normalizeEmail(body.email);
  const clientIp = resolveClientIp(c.req.raw);

  const emailError = validateEmail(email);
  if (emailError) {
    return c.json({ error: emailError }, 400);
  }

  const ipRateLimit = await recordRateLimitHit(
    c.env.SESSIONS,
    perIpRateLimitKey("reset-password-request", clientIp),
    RESET_REQUEST_LIMIT,
    RESET_REQUEST_WINDOW_SECONDS,
  );
  if (!ipRateLimit.allowed) {
    return rateLimitResponse(c, ipRateLimit.retryAfterSeconds);
  }

  const emailRateLimit = await recordRateLimitHit(
    c.env.SESSIONS,
    perEmailRateLimitKey("reset-password-request", email),
    RESET_REQUEST_LIMIT,
    RESET_REQUEST_WINDOW_SECONDS,
  );
  if (!emailRateLimit.allowed) {
    return rateLimitResponse(c, emailRateLimit.retryAfterSeconds);
  }

  if (!isPasswordResetEnabled(c)) {
    return c.json({
      error: "Password reset is not configured in this environment. Contact support for help.",
    }, 501);
  }

  const now = Math.floor(Date.now() / 1000);
  await cleanupExpiredResetTokens(c.env.DB, now);

  const user = await c.env.DB
    .prepare("SELECT id, email FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; email: string }>();

  if (user) {
    const resetToken = generateRefreshToken();
    const resetTokenHash = await hashToken(resetToken);
    const expiresAt = now + RESET_TOKEN_TTL_SECONDS;

    await c.env.DB
      .prepare("DELETE FROM password_reset_tokens WHERE user_id = ?")
      .bind(user.id)
      .run();

    await c.env.DB
      .prepare(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), user.id, resetTokenHash, expiresAt, now)
      .run();

    const delivered = await deliverPasswordResetWebhook({
      webhookUrl: c.env.PASSWORD_RESET_DELIVERY_WEBHOOK_URL as string,
      webhookToken: c.env.PASSWORD_RESET_DELIVERY_WEBHOOK_TOKEN,
      email: user.email,
      resetUrl: `${resolvePasswordResetOrigin(c)}/reset-password?token=${encodeURIComponent(resetToken)}`,
    });

    if (!delivered) {
      await c.env.DB
        .prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?")
        .bind(resetTokenHash)
        .run();
    }
  }

  return c.json({
    accepted: true,
  }, 202);
});

app.post("/reset-password/confirm", async (c) => {
  const body = await c.req.json();
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = body.password;
  const clientIp = resolveClientIp(c.req.raw);

  const passwordError = validatePassword(password);
  if (passwordError) {
    return c.json({ error: passwordError }, 400);
  }

  const ipRateLimit = await recordRateLimitHit(
    c.env.SESSIONS,
    perIpRateLimitKey("reset-password-confirm", clientIp),
    RESET_CONFIRM_LIMIT,
    RESET_CONFIRM_WINDOW_SECONDS,
  );
  if (!ipRateLimit.allowed) {
    return rateLimitResponse(c, ipRateLimit.retryAfterSeconds);
  }

  if (!token) {
    return c.json({ error: "Invalid or expired password reset link." }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  await cleanupExpiredResetTokens(c.env.DB, now);

  const tokenHash = await hashToken(token);
  const resetRecord = await c.env.DB
    .prepare(
      `SELECT user_id, expires_at, consumed_at
       FROM password_reset_tokens
       WHERE token_hash = ?`
    )
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: number; consumed_at: number | null }>();

  if (!resetRecord || resetRecord.consumed_at || resetRecord.expires_at <= now) {
    return c.json({ error: "Invalid or expired password reset link." }, 400);
  }

  const passwordHash = await hashPassword(password);

  await c.env.DB.batch([
    c.env.DB
      .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
      .bind(passwordHash, now, resetRecord.user_id),
    c.env.DB
      .prepare("UPDATE password_reset_tokens SET consumed_at = ? WHERE token_hash = ?")
      .bind(now, tokenHash),
    c.env.DB
      .prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?")
      .bind(resetRecord.user_id),
  ]);

  return c.json({
    reset: true,
  });
});

// ============================================================
// OAuth Callback (placeholder)
// ============================================================
app.get("/oauth/:provider/callback", async (c) => {
  const provider = c.req.param("provider");
  const code = c.req.query("code");
  const state = c.req.query("state");

  // OAuth flow implementation would go here
  // 1. Exchange code for tokens
  // 2. Get user info from provider
  // 3. Find or create user
  // 4. Link oauth_accounts
  // 5. Generate JWT tokens

  return c.json({
    error: "OAuth not fully implemented",
    provider,
    code: code ? "received" : "missing",
  }, 501);
});

export default app;
