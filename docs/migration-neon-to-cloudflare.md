# Migration Guide: Neon Postgres + Neon Auth → Cloudflare Workers

Last updated: 2026-04-24

This guide records the Neon Postgres + Neon Auth to Cloudflare Workers migration.
The migration has landed for the active frontend/auth/API persistence path; keep
this file as the status reference and rollback checklist while legacy
Neon/Postgres paths remain available for compatibility and GitHub-context
metadata.

## Overview

### Previous Architecture
- **Auth**: Neon Auth (Better Auth) - email/password, OAuth, JWT sessions
- **Database**: Neon Postgres via Data API (PostgREST-like)
- **Deployment**: Azure Static Web Apps

### Current Architecture
- **Auth**: Custom Auth Worker (JWT, PBKDF2 password hashing, KV sessions)
- **Database**: Cloudflare D1 (SQLite at edge)
- **Deployment**: Cloudflare Pages + Workers
- **Compatibility**: Legacy Neon env names and Postgres migrations remain for
  rollback and for the GitHub-context service storage path.

## Prerequisites

1. Cloudflare account with Workers + D1 enabled
2. Wrangler CLI installed: `npm install -g wrangler`
3. Authenticated with Cloudflare: `wrangler login`
4. Backup of existing Neon data

## Phase 1: Infrastructure Setup

### 1.1 Create D1 Database

```bash
wrangler d1 create promptforge-db
```

Note the `database_id` from output and update `wrangler.toml`.

### 1.2 Create KV Namespace for Sessions

```bash
wrangler kv:namespace create SESSIONS
wrangler kv:namespace create SESSIONS --preview
```

Update `wrangler.toml` with the namespace IDs.

### 1.3 Generate JWT Secret

```bash
# Generate 256-bit secret
openssl rand -hex 32 | wrangler secret put JWT_SECRET
```

### 1.4 Deploy Workers

```bash
# Deploy app Worker (auth + API + assets)
wrangler deploy
```

Record the worker URL from output:
- `https://promptforge.<subdomain>.workers.dev`

## Phase 2: Database Migration

### 2.1 Export Data from Neon

```bash
# Install psql if needed
# macOS: brew install postgresql
# Linux: apt install postgresql-client

node scripts/migrate-neon-to-d1.js \
  --neon-url "postgres://user:pass@host/neondb" \
  --output migration-export.json
```

### 2.2 Run D1 Schema

```bash
# Local testing
wrangler d1 execute promptforge-db --local --file=workers/d1/schema.sql

# Production
wrangler d1 execute promptforge-db --remote --file=workers/d1/schema.sql
```

### 2.3 Import Data

```bash
node scripts/import-d1.js --input migration-export.json --remote
```

### 2.4 Verify Migration

```bash
# Check row counts
wrangler d1 execute promptforge-db --remote --command \
  "SELECT 'users' as table, count(*) as rows FROM users
   UNION ALL SELECT 'profiles', count(*) FROM profiles
   UNION ALL SELECT 'saved_prompts', count(*) FROM saved_prompts;"
```

## Phase 3: Frontend Update

### 3.1 Update Environment Variables

Update `.env` and deployment secrets:

```bash
# Remove Neon vars
# VITE_NEON_PROJECT_ID
# VITE_NEON_DATA_API_URL
# VITE_NEON_AUTH_URL
# VITE_NEON_PUBLISHABLE_KEY

# Add Cloudflare vars
VITE_AUTH_WORKER_URL="https://promptforge.<subdomain>.workers.dev"
VITE_API_WORKER_URL="https://promptforge.<subdomain>.workers.dev"
```

### 3.2 Update GitHub Secrets

```bash
# In GitHub repo settings → Secrets → Actions

# Remove (or keep for transition period):
# VITE_NEON_DATA_API_URL
# VITE_NEON_AUTH_URL
# VITE_NEON_PUBLISHABLE_KEY

# Add:
VITE_AUTH_WORKER_URL
VITE_API_WORKER_URL
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

### 3.3 Verify Auth and Persistence Providers

The active app path should already point at the Cloudflare-backed providers:

1. `src/App.tsx` imports `AuthProvider` from `src/hooks/auth-provider-cf.tsx`.
2. `src/lib/persistence.ts` re-exports the Cloudflare Worker implementation
   from `src/lib/cf-persistence.ts`.
3. `.env` and deployment secrets provide `VITE_AUTH_WORKER_URL` and
   `VITE_API_WORKER_URL`.

## Phase 4: Testing

### 4.1 Auth Flows

Test in order:
1. **Registration**: Create new account
2. **Login**: Sign in with credentials
3. **Token refresh**: Wait 15 min or modify token expiry for testing
4. **Logout**: Sign out
5. **Session validation**: Reload page, verify persistence

### 4.2 Data Operations

Test each entity:
1. **Drafts**: Create, load, update, delete
2. **Prompts**: CRUD operations
3. **Sharing**: Share prompt to community
4. **Community**: Load feed, vote, comment

### 4.3 Edge Cases

- Unsigned user → localStorage fallback
- Network failures → error handling
- Token expiration → refresh flow
- Concurrent modifications → conflict detection

## Phase 5: Cutover

### 5.1 DNS/Domain Update

If using custom domain:

```bash
wrangler pages project create promptforge --production-branch=main
wrangler pages project update promptforge --domains=prompt.lakefrontdigital.io
```

### 5.2 Traffic Migration

For zero-downtime migration:

1. Deploy Workers + Pages in parallel with Azure
2. Update DNS to point to Cloudflare
3. Monitor for 24-48 hours
4. Decommission Azure SWA

### 5.3 Rollback Plan

If issues arise:

1. Revert DNS to Azure
2. Keep Neon database intact (don't delete immediately)
3. Investigate issues in staging first

## Post-Migration Checklist

- [ ] All auth flows working (register, login, logout, refresh)
- [ ] Draft autosave functional
- [ ] Prompt CRUD operations working
- [ ] Community feed loading
- [ ] Voting and commenting functional
- [ ] Profile management working
- [ ] Account deletion working
- [ ] OAuth providers configured (if using)
- [ ] Rate limiting configured on workers
- [ ] Monitoring/alerts set up (Cloudflare Analytics)
- [ ] Old Neon database backed up, then scheduled for deletion

## Troubleshooting

### CORS Errors

Check `CORS_ORIGIN` in wrangler.toml matches your frontend domain.

### Token Validation Failures

Ensure `JWT_SECRET` is identical in both auth and API workers.

### D1 Constraint Errors

SQLite has stricter type handling than Postgres. Check:
- Boolean values: use 0/1 integers
- JSON: stored as TEXT, parse in application
- Timestamps: Unix epoch seconds, not ISO strings

### KV Session Issues

Verify KV namespace ID in wrangler.toml matches created namespace.

## Cost Comparison

### Neon (Before)
- Postgres: ~$10-30/month (depending on tier)
- Auth: Included

### Cloudflare (After)
- Workers: First 100K requests/day free
- D1: First 5GB storage, 1B read rows/month free
- KV: First 1M reads, 10K writes free
- Pages: Unlimited bandwidth, 500 builds/month

**Expected savings**: Significant for low-medium traffic apps

## Support

For issues during migration:
1. Check Cloudflare Worker logs: `wrangler tail`
2. Review D1 query errors in console
3. Test locally with `wrangler dev`
4. Consult Cloudflare docs: https://developers.cloudflare.com/
