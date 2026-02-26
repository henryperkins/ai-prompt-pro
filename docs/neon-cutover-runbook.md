# Neon Cutover Runbook

Last updated: 2026-02-26

## Pre-cutover verification

Run from repo root:

```bash
npm run check:prod
```

This runs:

- `npm run check:docs`
- `npm run check:no-legacy-ui-imports`
- `npm run check:no-legacy-ds-props`
- `STRICT_PRIMITIVE_IMPORTS=1 npm run check:no-primitive-ds-imports`
- `npm run check:no-new-phosphor-imports`
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

## Production monitoring snapshot

Agent service resource:

- App Service: `ai-prompt-pro-agent`
- Resource group: `rg-ai-prompt-pro`
- Static Web App hostname: `gentle-dune-075b4710f.2.azurestaticapps.net`

Collect logs:

```bash
az webapp log download \
  --resource-group rg-ai-prompt-pro \
  --name ai-prompt-pro-agent \
  --log-file /tmp/ai-prompt-pro-agent-logs.zip
```

Collect metrics (last hour):

```bash
RESOURCE_ID=$(az webapp show --resource-group rg-ai-prompt-pro --name ai-prompt-pro-agent --query id -o tsv)
az monitor metrics list \
  --resource "$RESOURCE_ID" \
  --interval PT1H \
  --aggregation Average Total \
  --metrics Requests Http5xx AverageResponseTime
```

## Rollback readiness

1. Keep the previous production commit SHA available for redeploy.
2. Keep Azure deployment workflows enabled:
   - `.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml`
   - `.github/workflows/main_ai-prompt-pro-agent.yml`
3. Keep Neon runtime secrets configured in GitHub:
   - `VITE_NEON_PROJECT_ID`
   - `VITE_NEON_DATA_API_URL`
   - `VITE_NEON_AUTH_URL`
   - `VITE_NEON_PUBLISHABLE_KEY`
   - `VITE_AGENT_SERVICE_URL`
   - `NEON_API_KEY`
   - `NEON_PROJECT_ID` (repo variable)
4. Legacy Supabase edge functions are retained in `archive/supabase/functions` for audit/reference only.
