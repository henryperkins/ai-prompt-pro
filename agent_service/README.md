# Agent Service

This repo supports two `/enhance` backends:

1. `agent_service/codex_service.mjs` (recommended): Node service using `@openai/codex-sdk`
2. `agent_service/main.py` (legacy): Python service using Microsoft Agent Framework + Azure OpenAI

Both expose the same HTTP shape used by `supabase/functions/enhance-prompt`.

## Codex SDK service (recommended)

### Start

```bash
npm install
export OPENAI_API_KEY="<your-openai-api-key>"
npm run agent:codex
```

### Optional environment

```bash
export HOST="0.0.0.0"
export PORT="8001"
export AGENT_SERVICE_TOKEN="<shared-secret>"
export MAX_PROMPT_CHARS="16000"

# Codex client options
export OPENAI_BASE_URL="https://api.openai.com/v1"
export CODEX_API_KEY="<override-openai-api-key>"
export CODEX_PATH_OVERRIDE="/absolute/path/to/codex"
export CODEX_CONFIG_JSON='{"show_raw_agent_reasoning":true}'
export CODEX_ENV_JSON='{"PATH":"/usr/local/bin"}'

# Default thread options
export CODEX_MODEL="gpt-5.2-codex"
export CODEX_SANDBOX_MODE="workspace-write"      # read-only|workspace-write|danger-full-access
export CODEX_WORKING_DIRECTORY="/absolute/path/to/repo"
export CODEX_SKIP_GIT_REPO_CHECK="true"
export CODEX_MODEL_REASONING_EFFORT="medium"     # low|medium|high|xhigh
export CODEX_MODEL_VERBOSITY="low"               # low|medium|high
export CODEX_NETWORK_ACCESS_ENABLED="true"
export CODEX_WEB_SEARCH_MODE="live"              # disabled|cached|live
export CODEX_WEB_SEARCH_ENABLED="true"
export CODEX_APPROVAL_POLICY="never"             # never|on-request|on-failure|untrusted
export CODEX_ADDITIONAL_DIRECTORIES='["/tmp"]'   # JSON array or comma-delimited
```

### Endpoints

- `GET /health`
- `POST /enhance` with body `{ "prompt": "..." }`
- Optional request fields:
  - `thread_id`
  - `thread_options` (partial Codex thread options, including `modelReasoningEffort` and `modelVerbosity`)

## Legacy Python Azure service

If you still need the Azure Agent Framework backend, use `agent_service/main.py`.

### Start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r agent_service/requirements.txt
export AZURE_OPENAI_ENDPOINT="https://<your-resource>.openai.azure.com"
export AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME="gpt-5.2"
export AZURE_OPENAI_API_VERSION="preview"
export AZURE_OPENAI_API_KEY="<your-azure-openai-key>"
uvicorn agent_service.main:app --host 0.0.0.0 --port 8001 --reload
```
