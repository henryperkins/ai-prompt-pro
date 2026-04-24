# Agent Service Azure Exit Plan

Last updated: 2026-04-24

## Decision

Move the production `agent_service/` runtime from Azure App Service to
DigitalOcean. Use DigitalOcean App Platform as the first deployment target
because it can deploy dynamic Docker apps from GitHub with a declarative app
spec and GitHub Actions. Keep a Droplet + Docker deployment as the fallback if
staging shows App Platform is too restrictive for long-running SSE or
WebSocket traffic.

For a full Azure exit, run the agent with direct OpenAI provider configuration
(`OPENAI_API_KEY` or `CODEX_API_KEY`) instead of Azure OpenAI. Azure OpenAI
remains supported only as an optional provider override for rollback or
transitional deployments.

This repo now includes the first DigitalOcean deployment artifacts:

- `Dockerfile.agent` packages the current Node agent service as a container.
- `.do/app.yaml` defines the App Platform service, route, Dockerfile build,
  runtime env, and `/health` check.
- `scripts/render-digitalocean-app-spec.mjs` renders secret placeholders before
  `doctl` submits the app spec.
- `.github/workflows/digitalocean-agent.yml` is a manual `doctl` deployment
  workflow.

## Why DigitalOcean App Platform First

The current backend is not an edge-function shape. It is a long-running Node
HTTP service that:

- starts `node agent_service/codex_service.mjs`;
- uses `node:http` `createServer`;
- upgrades `/enhance/ws` through `ws` `WebSocketServer`;
- streams `/enhance` over SSE;
- reads provider/runtime configuration from process env;
- handles `SIGTERM` / `SIGINT` graceful shutdown;
- uses in-memory rate limits and extract-URL cache;
- optionally persists GitHub repository context through Postgres.

App Platform is the lowest-ops DigitalOcean option for this shape:

- It deploys dynamic apps, including Node.js and Docker services.
- It accepts a Dockerfile from the repository or a prebuilt container image.
- It can be managed through an app spec and deployed with `doctl`.
- Its service spec supports an `http_port`; if `PORT` is not set, App Platform
  injects it from that value. The service already honors `PORT`.
- It supports runtime secret env vars in the app spec.
- Its limits page says App Platform does not limit concurrent connections, but
  long-lived SSE and WebSocket behavior still needs staging validation because
  the official App Platform docs do not publish a dedicated WebSocket contract.

References:

- App Platform overview: <https://docs.digitalocean.com/products/app-platform/>
- App Platform features: <https://docs.digitalocean.com/products/app-platform/details/features/>
- App Platform app spec: <https://docs.digitalocean.com/products/app-platform/reference/app-spec/>
- App Platform GitHub Actions deploy: <https://docs.digitalocean.com/products/app-platform/how-to/deploy-from-github-actions/>
- App Platform limits: <https://docs.digitalocean.com/products/app-platform/details/limits/>
- `doctl` CLI reference: <https://docs.digitalocean.com/reference/doctl/>
- `doctl apps create`: <https://docs.digitalocean.com/reference/doctl/reference/apps/create/>
- `doctl apps spec validate`: <https://docs.digitalocean.com/reference/doctl/reference/apps/spec/validate/>

## Droplet Fallback

If App Platform breaks long streams or WebSocket sessions, move the same
container to a Droplet behind Caddy or Nginx. That adds server operations, but
it gives direct control over proxy read timeouts, WebSocket upgrade handling,
Docker logs, and restart policy.

The Droplet fallback should use:

- Ubuntu LTS or the DigitalOcean Docker marketplace image;
- Docker Compose running `Dockerfile.agent`;
- Caddy or Nginx terminating TLS and proxying to container port `8080`;
- a systemd-managed Docker service or `restart: unless-stopped`;
- DigitalOcean Firewall allowing only SSH, HTTP, and HTTPS;
- optional DigitalOcean Load Balancer if high availability is needed.

DigitalOcean Load Balancers explicitly support WebSockets without additional
configuration and use a one-hour inactivity timeout for WebSocket connections,
which makes them a stronger fit if managed App Platform behavior is not enough.

References:

- Droplet create docs: <https://docs.digitalocean.com/products/droplets/how-to/create/>
- Droplet user data docs: <https://docs.digitalocean.com/products/droplets/how-to/provide-user-data/>
- Docker marketplace image: <https://docs.digitalocean.com/products/marketplace/catalog/docker/>
- Load Balancer features: <https://docs.digitalocean.com/products/networking/load-balancers/details/features/>

## Migration Plan

### Phase 1 - Containerize

Done in this repo:

- Add `Dockerfile.agent`.
- Add `.dockerignore`.
- Keep the container command as `node agent_service/codex_service.mjs`.
- Default `PORT=8080` for managed container platforms, while preserving the
  service's ability to honor an injected `PORT`.

Local validation:

```sh
docker build -f Dockerfile.agent -t promptforge-agent:local .
docker run --rm --env-file .env -p 8001:8080 promptforge-agent:local
curl --fail http://localhost:8001/health
```

### Phase 2 - Bootstrap DigitalOcean

Create a DigitalOcean API token with App Platform read/write permissions and
store it as:

- `DIGITALOCEAN_ACCESS_TOKEN`

Authenticate the repository with App Platform once through the DigitalOcean
control panel or API, as required by DigitalOcean's GitHub Actions deployment
flow.

The app spec currently targets:

- repo: `henryperkins/ai-prompt-pro`
- branch: `main`
- service name: `promptforge-agent`
- region: `nyc`
- instance size: `apps-s-1vcpu-1gb`
- instances: `1`

### Phase 3 - Move Runtime Secrets

For a no-Azure production path, set these GitHub repository secrets:

- `OPENAI_API_KEY` or `CODEX_API_KEY`
- `VITE_AGENT_PUBLIC_API_KEY` (or legacy `VITE_NEON_PUBLISHABLE_KEY` /
  `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `AUTH_SESSION_VALIDATION_URL` or `VITE_AUTH_WORKER_URL`

For a hosting-only Azure App Service exit, the workflow can also deploy using
the existing Azure OpenAI provider secrets:

- `AZURE_OPENAI_API_KEY`
- `CODEX_CONFIG_JSON`

Do not keep both direct OpenAI/Codex and `CODEX_CONFIG_JSON` configured for the
DigitalOcean workflow. `CODEX_CONFIG_JSON` wins provider resolution, so leaving
an Azure-shaped config in place would keep inference on Azure even when
`OPENAI_API_KEY` is set.

The workflow resolves those values and passes them into `.do/app.yaml` as App
Platform runtime secrets:

- `OPENAI_API_KEY`
- `FUNCTION_PUBLIC_API_KEY`
- `AUTH_SESSION_VALIDATION_URL`
- `AZURE_OPENAI_API_KEY` and `CODEX_CONFIG_JSON` when using the transitional
  Azure OpenAI provider path

Recommended non-secret env for the first App Platform revision is already in
`.do/app.yaml`:

```txt
NODE_ENV=production
HOST=0.0.0.0
CODEX_SKIP_GIT_REPO_CHECK=true
REQUIRE_PROVIDER_CONFIG=false
CODEX_MODEL=gpt-5.4-mini
CODEX_MODEL_REASONING_EFFORT=xhigh
EXTRACT_MODEL=gpt-4.1-mini
INFER_MODEL=gpt-5.4
ALLOWED_ORIGINS=https://promptforge-lwu.pages.dev,https://prompt.lakefrontdigital.io,http://localhost:8080
```

Optional production secrets, depending on enabled features:

- `AGENT_SERVICE_TOKEN`
- `CODEX_CONFIG_JSON` for non-default provider config
- `NEON_DATABASE_URL` or `DATABASE_URL` for GitHub repository context
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_STATE_SECRET`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_POST_INSTALL_REDIRECT_URL`

Add optional secrets to `.do/app.yaml` and the deployment workflow only when the
feature is ready to be enabled in production.

### Phase 4 - Deploy And Smoke Test

Run the manual workflow:

- `.github/workflows/digitalocean-agent.yml`

The workflow installs `doctl`, renders `.do/app.yaml` to
`tmp/promptforge-agent.app.yaml`, validates the rendered spec schema without
printing the secret-bearing normalized spec, and deploys with:

```sh
doctl apps spec validate tmp/promptforge-agent.app.yaml --schema-only >/dev/null
```

Deployment uses:

```sh
doctl apps create \
  --spec tmp/promptforge-agent.app.yaml \
  --upsert \
  --update-sources \
  --wait
```

For local operator use, install `doctl`, authenticate with `doctl auth init`,
export the three required secret values, render the app spec, and run the same
validate/deploy commands:

```sh
mkdir -p tmp
node scripts/render-digitalocean-app-spec.mjs .do/app.yaml tmp/promptforge-agent.app.yaml
doctl apps spec validate tmp/promptforge-agent.app.yaml --schema-only >/dev/null
doctl apps create --spec tmp/promptforge-agent.app.yaml --upsert --update-sources --wait
doctl apps logs <app-id> promptforge-agent --type run --follow
```

After deploy, test the App Platform URL:

```sh
export AGENT_URL="https://<app-name>.ondigitalocean.app"

curl --fail "$AGENT_URL/health"
curl --fail "$AGENT_URL/ready"
curl --fail "$AGENT_URL/health/details"
```

Then validate the application endpoints:

- `POST /infer-builder-fields`
- `POST /extract-url`
- `POST /enhance` SSE
- `WS /enhance/ws`
- GitHub repository-context routes if those secrets are configured

For SSE and WebSockets, run a staging soak test that keeps the connection open
longer than a normal enhancement. If App Platform interrupts the stream before
the service does, switch to the Droplet fallback.

### Phase 5 - Frontend Cutover

Update the GitHub repository secret used by the Cloudflare Pages workflow:

- `VITE_AGENT_SERVICE_URL=https://<digitalocean-app-url-or-custom-domain>`

Rerun Cloudflare Pages deployment and verify the built frontend points to the
new service. Keep the Azure workflow untouched until the DigitalOcean service
has passed smoke tests in production.

### Phase 6 - Retire Azure

After DigitalOcean is healthy:

- disable or archive `.github/workflows/main_ai-prompt-pro-agent.yml`;
- remove Azure App Service secrets from GitHub;
- update `README.md` and `agent_service/README.md` to mark Azure App Service as
  retired rather than transitional;
- if Azure OpenAI is also being removed, delete production use of
  `AZURE_OPENAI_API_KEY` and Azure-shaped `CODEX_CONFIG_JSON`.

## Risks And Follow-Ups

- **Provider scope:** Leaving `AZURE_OPENAI_API_KEY` / Azure provider config in
  production still depends on Azure for inference. To remove Azure entirely,
  use direct OpenAI provider config.
- **Managed platform behavior:** App Platform is the easiest DigitalOcean path,
  but long-lived `/enhance` and `/enhance/ws` sessions must be tested before
  production cutover.
- **Rate limiting:** In-memory rate limits and caches are per app instance.
  Start with one instance or move rate limits to shared storage before scaling.
- **No persistent filesystem:** App Platform local filesystem data is not
  durable across deployments or container replacements.
- **GitHub context:** If GitHub routes are enabled, run the existing Postgres
  migration and configure all GitHub secrets as a complete set.
- **Custom domain:** Prefer a stable custom domain for
  `VITE_AGENT_SERVICE_URL` before final production cutover.
