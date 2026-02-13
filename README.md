# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### Deploy to Azure Static Web Apps (production)

This repo is configured for Azure Static Web Apps using:

- Workflow: `.github/workflows/azure-static-web-apps-gentle-dune-075b4710f.yml`
- SWA CLI config: `swa-cli.config.json`
- Runtime routing/security config: `public/staticwebapp.config.json`

Required GitHub repository secrets:

- `AZURE_STATIC_WEB_APPS_API_TOKEN_GENTLE_DUNE_075B4710F`
- `VITE_NEON_PROJECT_ID`
- `VITE_NEON_DATA_API_URL`
- `VITE_NEON_AUTH_URL`
- `VITE_NEON_PUBLISHABLE_KEY`
- `VITE_AGENT_SERVICE_URL`

Deployment flow:

```sh
# Validate production build locally
npm run build

# Optional: preview SWA packaging locally
npm run swa:build
npm run swa:start

# Manual production deploy (if needed outside CI)
npm run swa:deploy:dry-run
npm run swa:deploy
```

CI/CD flow:

- Push to `main` triggers production deployment to the linked Azure Static Web App.
- Pull requests create/update preview environments and close them when PRs are closed.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Codex SDK Agent Service (recommended)

This project can route prompt enhancement through a Node service that uses `@openai/codex-sdk`.

1. Install deps and start the Codex service:
```sh
npm install
export OPENAI_API_KEY="<your-openai-api-key>"
# Optional Codex SDK overrides
# export OPENAI_BASE_URL="https://api.openai.com/v1"
# export CODEX_MODEL="gpt-5.2-codex"
# export CODEX_SANDBOX_MODE="workspace-write"   # read-only|workspace-write|danger-full-access
# export CODEX_WORKING_DIRECTORY="/absolute/path/to/repo"
# export CODEX_SKIP_GIT_REPO_CHECK="true"
# export CODEX_MODEL_REASONING_EFFORT="medium"  # low|medium|high|xhigh
# export CODEX_MODEL_VERBOSITY="low"            # low|medium|high
# export CODEX_NETWORK_ACCESS_ENABLED="true"
# export CODEX_WEB_SEARCH_MODE="live"           # disabled|cached|live
# export CODEX_APPROVAL_POLICY="never"          # never|on-request|on-failure|untrusted
npm run agent:codex
```

2. Configure frontend + runtime env:
```sh
export VITE_AGENT_SERVICE_URL="http://localhost:8001"
export VITE_NEON_DATA_API_URL="https://<your-endpoint>.apirest.c-<region>.aws.neon.tech/neondb/rest/v1"
export VITE_NEON_AUTH_URL="https://<your-endpoint>.neonauth.c-<region>.aws.neon.tech/neondb/auth"
# Optional fallback key for signed-out function calls
export VITE_NEON_PUBLISHABLE_KEY="<neon-publishable-key>"
```

Optional hardening:
```sh
export AGENT_SERVICE_TOKEN="<shared-secret>"
```

Local dev note:
- `ALLOW_UNVERIFIED_JWT_FALLBACK=true` enables decoded-JWT fallback only when Neon Auth config/service is unavailable.
- Use this for local development only and keep it disabled in production.

3. Run the frontend as usual:
```sh
npm run dev
```

## Agent service

The prompt enhancement backend uses `@openai/codex-sdk`. See `agent_service/README.md` for setup and configuration.

## Database rollout notes

- Migration `20260210010000_phase1_community_schema.sql` backfills `public.templates` into `public.saved_prompts`.
- During rollout, `public.templates` is intentionally retained for compatibility and rollback safety.
- Active prompt persistence paths in the app now target `public.saved_prompts`; plan a follow-up migration to drop `public.templates` after rollout validation.
