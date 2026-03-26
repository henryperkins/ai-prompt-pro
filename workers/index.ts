/**
 * PromptForge — Single Cloudflare Worker
 * Serves API routes, Auth routes, and static frontend assets.
 *
 * Static assets are served automatically by the Workers runtime via
 * the [assets] configuration in wrangler.toml for any request that
 * doesn't match an API/auth route.
 */

import api from "./api/index";
import auth from "./auth/index";
import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  PASSWORD_RESET_DELIVERY_WEBHOOK_URL?: string;
  PASSWORD_RESET_DELIVERY_WEBHOOK_TOKEN?: string;
  PASSWORD_RESET_PUBLIC_ORIGIN?: string;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// Global error handler — surfaces uncaught errors in logs + response
app.onError((err, c) => {
  console.error(`[${c.req.method} ${c.req.path}] Unhandled error:`, err.message, err.stack);
  return c.json({ error: "Internal server error", detail: err.message }, 500);
});

// Global CORS — only needed for cross-origin dev (Vite on 8080, Worker on 8787).
// In production same-origin requests skip CORS entirely.
app.use("/api/*", async (c, next) => {
  const allowedOrigins = [
    c.env.CORS_ORIGIN || "https://prompt.lakefrontdigital.io",
    "http://localhost:8080",
  ];
  const requestOrigin = c.req.header("origin") || "";
  const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  return cors({
    origin,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })(c, next);
});

app.use("/auth/*", async (c, next) => {
  const allowedOrigins = [
    c.env.CORS_ORIGIN || "https://prompt.lakefrontdigital.io",
    "http://localhost:8080",
  ];
  const requestOrigin = c.req.header("origin") || "";
  const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  return cors({
    origin,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })(c, next);
});

// Mount auth routes under /auth/*
app.route("/auth", auth);

// Mount API routes — the api app already prefixes /api/*
app.route("/", api);

// Root health check
app.get("/health", (c) =>
  c.json({ status: "ok", worker: "promptforge", timestamp: Date.now() }),
);

// Fallback: serve static assets for SPA routing.
app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
