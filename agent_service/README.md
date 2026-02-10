# Agent Service (Microsoft Agent Framework + Azure OpenAI Responses)

This service hosts a Microsoft Agent Framework agent that uses Azure OpenAI Responses API with your `gpt-5.2` deployment.

## 1) Create a Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r agent_service/requirements.txt
```

## 2) Configure environment

```bash
export AZURE_OPENAI_ENDPOINT="https://<your-resource>.openai.azure.com"
export AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME="gpt-5.2"
export AZURE_OPENAI_API_VERSION="preview"
export AZURE_OPENAI_API_KEY="<your-azure-openai-key>"
# or use base URL form instead of endpoint
# export AZURE_OPENAI_BASE_URL="https://<your-resource>.openai.azure.com/openai/v1/"
```

Optional shared secret between Supabase Edge Function and this service:

```bash
export AGENT_SERVICE_TOKEN="<shared-secret>"
```

Optional GPT-5 reasoning/output controls (Responses API):

```bash
export AZURE_OPENAI_MAX_OUTPUT_TOKENS="4096"
export AZURE_OPENAI_REASONING_EFFORT="minimal"   # none|minimal|low|medium|high|xhigh
export AZURE_OPENAI_REASONING_SUMMARY="auto"     # auto|concise|detailed
export AZURE_OPENAI_TEXT_VERBOSITY="low"         # low|medium|high
```

Optional 429 retry tuning (Azure throttling):

```bash
export AZURE_429_MAX_RETRIES="2"                 # retries before surfacing failure
export AZURE_429_BACKOFF_BASE_SECONDS="1.0"      # exponential base delay
export AZURE_429_BACKOFF_MAX_SECONDS="20.0"      # upper bound per retry sleep
```

Optional hosted web search tool:

```bash
export ENABLE_HOSTED_WEB_SEARCH="true"           # true|false
export HOSTED_WEB_SEARCH_CITY="Seattle"          # optional
export HOSTED_WEB_SEARCH_REGION="WA"             # optional
export HOSTED_WEB_SEARCH_COUNTRY="US"            # optional
```

Optional advanced AzureOpenAIResponsesClient settings:

```bash
export AZURE_OPENAI_AD_TOKEN="<aad-token>"       # optional alternative auth
export AZURE_OPENAI_TOKEN_ENDPOINT="https://cognitiveservices.azure.com/.default"
export AZURE_OPENAI_INSTRUCTION_ROLE="system"    # or developer
export AZURE_OPENAI_ENV_FILE_PATH=".env.agent"
export AZURE_OPENAI_ENV_FILE_ENCODING="utf-8"
export AZURE_OPENAI_DEFAULT_HEADERS_JSON='{"x-trace-id":"prompt-enhancer"}'
```

If you do not set `AZURE_OPENAI_API_KEY`, the service uses `AzureCliCredential` (run `az login`).

## 3) Run the service

```bash
uvicorn agent_service.main:app --host 0.0.0.0 --port 8001 --reload
```

Health check:

```bash
curl http://localhost:8001/health
```
