# PromptForge Cloudflare Workers

Last updated: 2026-04-24

This directory contains the Cloudflare Workers implementation for PromptForge's backend:

## Structure

```
workers/
├── index.ts             # Single Worker entry point for /auth/*, /api/*, health, and assets
├── api/
│   ├── index.ts          # API route module (Hono router)
│   └── handlers.ts       # Database handlers for REST endpoints
├── auth/
│   └── index.ts          # Auth route module (JWT, email/password, OAuth)
├── email/
│   └── index.ts          # Email delivery Worker (Resend webhook)
├── lib/
│   └── auth.ts           # Auth utilities (JWT, password hashing, sessions)
└── d1/
    └── schema.sql        # D1 database schema (SQLite)
```

## Workers

### App Worker (`promptforge`)

The main worker is configured by `wrangler.toml` and serves auth routes, API
routes, health checks, and static frontend assets from one deployment.

#### Auth Routes

Handles authentication:
- `GET /auth/capabilities` - Discover enabled auth capabilities
- `POST /auth/register` - Email/password registration
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout
- `GET /auth/session` - Validate session
- `DELETE /auth/account` - Delete account
- `POST /auth/reset-password` - Request password reset
- `POST /auth/reset-password/confirm` - Confirm password reset
- `GET /auth/oauth/:provider/callback` - OAuth callback (placeholder)

#### API Routes

Handles data operations:
- `GET/POST/DELETE /api/drafts` - Draft management
- `GET/POST/PUT/DELETE /api/prompts` - Prompt CRUD
- `POST /api/prompts/:id/share` - Share to community
- `POST /api/prompts/:id/unshare` - Unshare
- `GET /api/community` - Community feed
- `POST /api/community/:id/vote` - Vote
- `POST/PUT/DELETE /api/community/comments` - Comments
- `GET/PUT /api/profile/me` - Profile

### Email Worker (`promptforge-email`)

Transactional email delivery via Resend (config: `wrangler.email.toml`):
- `POST /send` - Deliver a transactional email (webhook receiver)
- `GET /health` - Health check

The auth worker calls `POST /send` when a user requests a password reset.
The email worker validates the shared bearer token, then sends the email
through the Resend API.

## Local Development

```bash
# Install dependencies
npm install

# Start the app Worker locally (auth + API + assets on port 8787)
wrangler dev

# Start Email Worker locally (port 8788)
wrangler dev --config wrangler.email.toml

# Create D1 database locally
wrangler d1 create promptforge-db

# Run schema migrations
wrangler d1 execute promptforge-db --local --file=workers/d1/schema.sql

# Create KV namespace
wrangler kv:namespace create SESSIONS
```

## Deployment

```bash
# Deploy app Worker
wrangler deploy

# Deploy Email Worker
wrangler deploy --config wrangler.email.toml

# Deploy with production environment
wrangler deploy --env production
```

## Environment Variables

Set via `wrangler secret put`:

### App Worker
- `JWT_SECRET` - HMAC secret for JWT signing (min 32 bytes)
- `CORS_ORIGIN` - Allowed CORS origin (default: production URL)
- `PASSWORD_RESET_DELIVERY_WEBHOOK_URL` - Optional webhook that sends password reset emails
- `PASSWORD_RESET_DELIVERY_WEBHOOK_TOKEN` - Optional bearer token for the webhook
- `PASSWORD_RESET_PUBLIC_ORIGIN` - Optional public app origin for reset links (falls back to request origin)

### Email Worker
- `RESEND_API_KEY` - API key from [resend.com](https://resend.com)
- `WEBHOOK_TOKEN` - Shared bearer token (must match `PASSWORD_RESET_DELIVERY_WEBHOOK_TOKEN` on the auth worker)
- `EMAIL_FROM` - Optional sender address (default: `PromptForge <noreply@lakefrontdigital.io>`)

## Password Reset Delivery

Password reset is capability-gated. If `PASSWORD_RESET_DELIVERY_WEBHOOK_URL` is
unset, `GET /auth/capabilities` reports `passwordResetEnabled: false`, the
request endpoint returns `501`, and the frontend points locked-out users to
support instead of pretending reset succeeded.

When enabled, the auth worker POSTs this JSON payload to the email worker:

```json
{
  "type": "password_reset",
  "email": "user@example.com",
  "reset_url": "https://prompt.lakefrontdigital.io/reset-password?token=...",
  "app_name": "PromptForge"
}
```

### Setup (one-time)

1. **Resend account**: Sign up at [resend.com](https://resend.com) (free tier: 3k emails/month).
   Add and verify `lakefrontdigital.io` as a sending domain — Resend will walk
   you through the DNS records (DKIM, SPF, return-path).

2. **Deploy the email worker**:
   ```bash
   wrangler deploy --config wrangler.email.toml
   ```

3. **Set email worker secrets**:
   ```bash
   wrangler secret put RESEND_API_KEY --config wrangler.email.toml
   wrangler secret put WEBHOOK_TOKEN --config wrangler.email.toml
   ```

4. **Wire the auth worker** — point it at the email worker and share the token:
   ```bash
   # Use your actual workers.dev subdomain
   echo "https://promptforge-email.<subdomain>.workers.dev/send" \
     | wrangler secret put PASSWORD_RESET_DELIVERY_WEBHOOK_URL

   # Must match the WEBHOOK_TOKEN set on the email worker
   wrangler secret put PASSWORD_RESET_DELIVERY_WEBHOOK_TOKEN
   ```

5. **Verify**: `GET /auth/capabilities` should now return `passwordResetEnabled: true`,
   and the sign-in dialog will offer the "Forgot password?" link.

## Secrets Generation

```bash
# Generate secure JWT secret
openssl rand -hex 32 | wrangler secret put JWT_SECRET

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | wrangler secret put JWT_SECRET
```

## Migration from Neon

See `docs/migration-neon-to-cloudflare.md` for the full migration guide.

### Quick Migration Steps

1. Export data from Neon:
   ```bash
   node scripts/migrate-neon-to-d1.js --neon-url <postgres-url> --output migration.json
   ```

2. Create D1 and run schema:
   ```bash
   wrangler d1 create promptforge-db
   wrangler d1 execute promptforge-db --remote --file=workers/d1/schema.sql
   ```

3. Import data:
   ```bash
   node scripts/import-d1.js --input migration.json --remote
   ```

4. Deploy workers:
   ```bash
   wrangler deploy
   ```

5. Update frontend env vars:
   - `VITE_AUTH_WORKER_URL`
   - `VITE_API_WORKER_URL`

For the single-worker deployment, both frontend env vars can point to the same
base URL, for example `https://promptforge.<subdomain>.workers.dev` or
`http://localhost:8787`.
