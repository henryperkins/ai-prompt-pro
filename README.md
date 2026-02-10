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

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Azure OpenAI Responses via Microsoft Agent Framework

This project now routes prompt enhancement through a Microsoft Agent Framework Python service that uses Azure OpenAI Responses API.

1. Start the agent service:
```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r agent_service/requirements.txt
export AZURE_OPENAI_ENDPOINT="https://<your-resource>.openai.azure.com"
export AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME="gpt-5.2"
export AZURE_OPENAI_API_VERSION="preview"
export AZURE_OPENAI_API_KEY="<your-azure-openai-key>"
# Optional: use base_url instead of endpoint
# export AZURE_OPENAI_BASE_URL="https://<your-resource>.openai.azure.com/openai/v1/"
# Optional GPT-5 reasoning/output controls
export AZURE_OPENAI_MAX_OUTPUT_TOKENS="4096"
export AZURE_OPENAI_REASONING_EFFORT="minimal"
export AZURE_OPENAI_REASONING_SUMMARY="auto"
export AZURE_OPENAI_TEXT_VERBOSITY="low"
# Optional hosted web search tool
export ENABLE_HOSTED_WEB_SEARCH="true"
export HOSTED_WEB_SEARCH_CITY="Seattle"
export HOSTED_WEB_SEARCH_REGION="WA"
export HOSTED_WEB_SEARCH_COUNTRY="US"
# Optional advanced AzureOpenAIResponsesClient settings
export AZURE_OPENAI_AD_TOKEN="<aad-token>"
export AZURE_OPENAI_TOKEN_ENDPOINT="https://cognitiveservices.azure.com/.default"
export AZURE_OPENAI_INSTRUCTION_ROLE="system"
export AZURE_OPENAI_DEFAULT_HEADERS_JSON='{"x-trace-id":"prompt-enhancer"}'
uvicorn agent_service.main:app --host 0.0.0.0 --port 8001 --reload
```

2. Configure the `enhance-prompt` Supabase function secrets:
```sh
supabase secrets set AGENT_SERVICE_URL="http://host.docker.internal:8001"
supabase secrets set SUPABASE_URL="https://<project-ref>.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="<project-anon-or-publishable-key>"
```

Optional hardening:
```sh
supabase secrets set AGENT_SERVICE_TOKEN="<shared-secret>"
export AGENT_SERVICE_TOKEN="<shared-secret>"
```

Local dev note:
- `ALLOW_UNVERIFIED_JWT_FALLBACK=true` enables decoded-JWT fallback only when Supabase Auth config/service is unavailable.
- Use this for local development only and keep it disabled in production.

3. Run the frontend as usual:
```sh
npm run dev
```

## Database rollout notes

- Migration `20260210010000_phase1_community_schema.sql` backfills `public.templates` into `public.saved_prompts`.
- During rollout, `public.templates` is intentionally retained for compatibility and rollback safety.
- Active prompt persistence paths in the app now target `public.saved_prompts`; plan a follow-up migration to drop `public.templates` after rollout validation.
