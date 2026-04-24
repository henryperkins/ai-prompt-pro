# Legacy Neon and Agent Operations Runbook

Last updated: 2026-04-24

The active frontend and app persistence path now runs on Cloudflare Pages,
Cloudflare Workers, and D1. Keep this runbook for remaining Neon/Postgres
compatibility paths, GitHub-context storage, agent-service monitoring, and
rollback readiness.
File path remains `docs/neon-cutover-runbook.md` for compatibility with existing references.

## Pre-release verification

Run from repo root:

```bash
npm run check:prod
```

This runs:

- `npm run check:docs`
- `npm run check:no-legacy-ui-imports`
- `npm run check:no-legacy-ds-props`
- `npm run check:no-deprecated-ds-bridges`
- `npm run check:no-deprecated-textarea-usage`
- `npm run check:no-duplicate-ds-entrypoints`
- `STRICT_PRIMITIVE_IMPORTS=1 npm run check:no-primitive-ds-imports`
- `npm run check:no-new-phosphor-imports`
- `npm run check:no-literal-colors`
- `npm run check:no-arbitrary-typography`
- `npm run check:design-system-baseline`
- `npm run lint`
- `npm run test:unit`
- `npm run build`
- `npm run check:token-runtime`

## Smoke validation

Primary smoke validation uses the test suite:

- Prompt CRUD/persistence: `src/test/persistence.test.ts`
- Community flows (post/comment/vote): `src/test/community-load-post.test.ts`, `src/test/community-hydration-resilience.test.tsx`
- AI enhancement/extraction/inference client behavior: `src/test/ai-client-auth.test.ts`, `src/test/ai-client-sse.test.ts`, `src/test/builder-inference.test.ts`
- Notifications refresh behavior: `src/test/useNotifications.test.ts`, `src/test/notifications-lib.test.ts`

## Production monitoring baseline

Agent service resource:

- App Service: `promptforge-agent`
- Resource group: `rg-promptforge`
- Frontend hostname: `prompt.lakefrontdigital.io` (Cloudflare Pages)

Collect logs:

```bash
az webapp log download \
  --resource-group rg-promptforge \
  --name promptforge-agent \
  --log-file /tmp/promptforge-agent-logs.zip
```

Collect metrics (last hour):

```bash
RESOURCE_ID=$(az webapp show --resource-group rg-promptforge --name promptforge-agent --query id -o tsv)
az monitor metrics list \
  --resource "$RESOURCE_ID" \
  --interval PT1H \
  --aggregation Average Total \
  --metrics Requests Http5xx AverageResponseTime
```

## Rollback readiness

1. Keep the previous production commit SHA available for redeploy.
2. Keep active Cloudflare deployment workflows enabled:
   - `.github/workflows/cloudflare-pages.yml`
   - `.github/workflows/cloudflare-workers.yml`
3. Keep the agent-service workflow available while the service runs on Azure:
   - `.github/workflows/main_ai-prompt-pro-agent.yml`
4. Keep only the legacy Neon/Postgres secrets still needed by the remaining
   compatibility paths, such as GitHub-context `NEON_DATABASE_URL` /
   `DATABASE_URL` and legacy auth validation values when configured.
5. Legacy Supabase edge functions are retained in `archive/supabase/functions` for audit/reference only.
