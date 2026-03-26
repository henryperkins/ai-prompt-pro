# PromptForge Cloudflare Workers

This directory contains the Cloudflare Workers implementation for PromptForge's backend:

## Structure

```
workers/
├── api/
│   ├── index.ts          # API Worker entry point (Hono router)
│   └── handlers.ts       # Database handlers for REST endpoints
├── auth/
│   └── index.ts          # Auth Worker entry point (JWT, email/password, OAuth)
├── lib/
│   └── auth.ts           # Auth utilities (JWT, password hashing, sessions)
└── d1/
    └── schema.sql        # D1 database schema (SQLite)
```

## Workers

### Auth Worker (`promptforge-auth`)

Handles authentication:
- `POST /auth/register` - Email/password registration
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout
- `GET /auth/session` - Validate session
- `DELETE /auth/account` - Delete account
- `GET /auth/oauth/:provider/callback` - OAuth callback (placeholder)

### API Worker (`promptforge`)

Handles data operations:
- `GET/POST/DELETE /api/drafts` - Draft management
- `GET/POST/PUT/DELETE /api/prompts` - Prompt CRUD
- `POST /api/prompts/:id/share` - Share to community
- `POST /api/prompts/:id/unshare` - Unshare
- `GET /api/community` - Community feed
- `POST /api/community/:id/vote` - Vote
- `POST/PUT/DELETE /api/community/comments` - Comments
- `GET/PUT /api/profile/me` - Profile

## Local Development

```bash
# Install dependencies
npm install

# Start API Worker locally
wrangler dev

# Start Auth Worker locally
wrangler dev --config wrangler.auth.toml

# Create D1 database locally
wrangler d1 create promptforge-db

# Run schema migrations
wrangler d1 execute promptforge-db --local --file=workers/d1/schema.sql

# Create KV namespace
wrangler kv:namespace create SESSIONS
```

## Deployment

```bash
# Deploy API Worker
wrangler deploy

# Deploy Auth Worker
wrangler deploy --config wrangler.auth.toml

# Deploy with production environment
wrangler deploy --env production
```

## Environment Variables

Set via `wrangler secret put`:

### Auth Worker
- `JWT_SECRET` - HMAC secret for JWT signing (min 32 bytes)

### API Worker
- `JWT_SECRET` - Same as auth worker (for token verification)
- `CORS_ORIGIN` - Allowed CORS origin (default: production URL)

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
   wrangler deploy --config wrangler.auth.toml
   ```

5. Update frontend env vars:
   - `VITE_AUTH_WORKER_URL`
   - `VITE_API_WORKER_URL`
