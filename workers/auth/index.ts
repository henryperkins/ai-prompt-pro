/**
 * PromptForge Auth Worker
 * Authentication service with JWT, email/password, and OAuth
 */

import { Hono } from "hono";
import { generateJwt, verifyToken, hashPassword, verifyPassword, hashToken } from "../lib/auth";

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
};

type Variables = {
  userId: string | null;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

// ============================================================
// Registration
// ============================================================
app.post("/register", async (c) => {
  const body = await c.req.json();
  const { email, password, displayName } = body;

  if (!email || !password) {
    return c.json({ error: "Email and password required" }, 400);
  }

  // Check if user exists
  const existing = await c.env.DB
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email.toLowerCase())
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
    .bind(userId, email.toLowerCase(), passwordHash, displayName || null, now, now)
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
    { sub: userId, email: email.toLowerCase() },
    c.env.JWT_SECRET,
    60 * 15 // 15 minutes
  );

  const refreshToken = crypto.randomUUID();
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
      email: email.toLowerCase(),
      displayName,
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
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: "Email and password required" }, 400);
  }

  // Get user
  const user = await c.env.DB
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first();

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Generate tokens
  const accessToken = await generateJwt(
    { sub: user.id, email: user.email },
    c.env.JWT_SECRET,
    60 * 15 // 15 minutes
  );

  const refreshToken = crypto.randomUUID();
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

  if (!refreshToken) {
    return c.json({ error: "Refresh token required" }, 400);
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
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at < now) {
    await c.env.SESSIONS.delete(`session:${refreshToken}`);
    return c.json({ error: "Refresh token expired" }, 401);
  }

  // Get user for new token
  const user = await c.env.DB
    .prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(userId)
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
  return c.json({
    error: "Password reset is not available in this build.",
  }, 501);
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
