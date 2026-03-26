/**
 * PromptForge Email Delivery Worker
 *
 * Webhook endpoint that receives password-reset (and future transactional)
 * email requests from the auth worker and delivers them via Resend.
 *
 * Secrets (set via `wrangler secret put`):
 *   RESEND_API_KEY          – Resend API key
 *   WEBHOOK_TOKEN           – shared bearer token the auth worker sends
 */

import { Hono } from "hono";

type Bindings = {
  RESEND_API_KEY: string;
  WEBHOOK_TOKEN?: string;
  EMAIL_FROM?: string;
};

interface PasswordResetPayload {
  type: "password_reset";
  email: string;
  reset_url: string;
  app_name: string;
}

const app = new Hono<{ Bindings: Bindings }>();

/** Verify the shared bearer token when WEBHOOK_TOKEN is set. */
app.use("/send", async (c, next) => {
  const expected = c.env.WEBHOOK_TOKEN?.trim();
  if (!expected) return next();

  const auth = c.req.header("Authorization");
  if (auth !== `Bearer ${expected}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.post("/send", async (c) => {
  const body = await c.req.json<PasswordResetPayload>();

  if (body.type !== "password_reset") {
    return c.json({ error: "Unknown email type" }, 400);
  }

  if (!body.email || !body.reset_url) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const from =
    c.env.EMAIL_FROM?.trim() ||
    `${body.app_name || "PromptForge"} <noreply@hperkins.com>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [body.email],
      subject: `Reset your ${body.app_name || "PromptForge"} password`,
      html: passwordResetHtml(body),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return c.json({ error: "Delivery failed", detail }, 502);
  }

  return c.json({ ok: true });
});

app.get("/health", (c) =>
  c.json({ status: "ok", worker: "promptforge-email", timestamp: Date.now() }),
);

export default app;

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

function passwordResetHtml(payload: PasswordResetPayload): string {
  const { reset_url, app_name = "PromptForge" } = payload;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <tr><td style="padding-bottom:24px;font-size:20px;font-weight:600;color:#18181b">${app_name}</td></tr>
        <tr><td style="padding-bottom:16px;font-size:16px;color:#3f3f46;line-height:1.5">
          You requested a password reset. Click the button below to choose a new password.
        </td></tr>
        <tr><td style="padding-bottom:24px" align="center">
          <a href="${escapeHtml(reset_url)}"
             style="display:inline-block;padding:12px 32px;background:#7c3aed;color:#fff;font-size:16px;font-weight:500;text-decoration:none;border-radius:6px">
            Reset password
          </a>
        </td></tr>
        <tr><td style="font-size:14px;color:#71717a;line-height:1.5">
          This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.
        </td></tr>
        <tr><td style="padding-top:24px;font-size:12px;color:#a1a1aa">
          If the button doesn't work, copy and paste this URL into your browser:<br>
          <a href="${escapeHtml(reset_url)}" style="color:#7c3aed;word-break:break-all">${escapeHtml(reset_url)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
