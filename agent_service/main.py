import json
import os
from functools import lru_cache
from typing import Annotated, Any, AsyncIterator, Mapping
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agent_framework import HostedWebSearchTool
from agent_framework.azure import AzureOpenAIResponsesClient
from agent_framework.observability import configure_otel_providers
from azure.identity import AzureCliCredential

# ---------------------------------------------------------------------------
# Observability – OpenTelemetry auto-instrumentation for agent spans/metrics.
# Reads standard OpenTelemetry env vars automatically:
#   ENABLE_INSTRUMENTATION=true        – master switch (disabled by default)
#   ENABLE_CONSOLE_EXPORTERS=true      – emit spans/metrics to stdout
#   OTEL_EXPORTER_OTLP_ENDPOINT=…      – send to an OTLP collector
#   ENABLE_SENSITIVE_DATA=true          – include prompt/completion text in spans
# ---------------------------------------------------------------------------
if os.getenv("ENABLE_INSTRUMENTATION", "").strip().lower() in {"1", "true", "yes", "on"}:
    configure_otel_providers()

MAX_PROMPT_CHARS = int(os.getenv("MAX_PROMPT_CHARS", "16000"))

PROMPT_ENHANCER_INSTRUCTIONS = """You are an expert prompt engineer. Your job is to take a structured prompt and enhance it to be more effective, clear, and optimized for large language models.

Rules:
- Keep the original intent perfectly intact
- Improve clarity, specificity, and structure
- Add helpful instructions the user may have missed
- Use clear section headers (Role, Task, Context, Format, Constraints)
- Be concise but thorough
- Return ONLY the enhanced prompt text, no explanations or meta-commentary
- Do not wrap in markdown code blocks
- Maintain a professional and direct tone
- Use available tools when useful to verify structure before finalizing"""

CORE_SECTIONS = ("Role", "Task", "Context", "Format", "Constraints")


class EnhanceRequest(BaseModel):
    prompt: str


class HealthResponse(BaseModel):
    ok: bool
    deployment: str


def inspect_prompt_structure(
    prompt: Annotated[str, Field(description="The prompt draft to inspect for required sections.")],
) -> dict[str, object]:
    """Inspect a prompt draft and report whether core sections are present."""
    normalized = prompt.lower()

    def has_section(name: str) -> bool:
        token = name.lower()
        patterns = (
            f"{token}:",
            f"{token} -",
            f"## {token}",
            f"### {token}",
            f"[{token}]",
        )
        return any(pattern in normalized for pattern in patterns)

    present = [section for section in CORE_SECTIONS if has_section(section)]
    missing = [section for section in CORE_SECTIONS if section not in present]
    return {
        "present_sections": present,
        "missing_sections": missing,
        "char_count": len(prompt),
    }


def _normalize_enum(name: str, value: str, allowed: tuple[str, ...]) -> str:
    normalized = value.strip().lower()
    if normalized not in allowed:
        raise RuntimeError(
            f"{name} has invalid value '{value}'. Allowed values: {', '.join(allowed)}"
        )
    return normalized


def _normalize_bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(
        f"{name} has invalid value '{raw}'. Allowed values: true/false, 1/0, yes/no, on/off."
    )


def _build_agent_tools() -> list[object]:
    tools: list[object] = [inspect_prompt_structure]
    if not _normalize_bool_env("ENABLE_HOSTED_WEB_SEARCH", default=False):
        return tools

    city = os.getenv("HOSTED_WEB_SEARCH_CITY")
    country = os.getenv("HOSTED_WEB_SEARCH_COUNTRY")
    region = os.getenv("HOSTED_WEB_SEARCH_REGION")

    location_payload: dict[str, str] = {}
    if city and city.strip():
        location_payload["city"] = city.strip()
    if country and country.strip():
        location_payload["country"] = country.strip()
    if region and region.strip():
        location_payload["region"] = region.strip()

    additional_properties = {"user_location": location_payload} if location_payload else None
    tools.append(
        HostedWebSearchTool(
            description="Search the web for up-to-date, factual context when needed.",
            additional_properties=additional_properties,
        )
    )
    return tools


def _build_run_options() -> dict[str, object]:
    options: dict[str, object] = {}
    max_output_tokens = os.getenv("AZURE_OPENAI_MAX_OUTPUT_TOKENS")
    reasoning_effort = os.getenv("AZURE_OPENAI_REASONING_EFFORT")
    reasoning_summary = os.getenv("AZURE_OPENAI_REASONING_SUMMARY")
    text_verbosity = os.getenv("AZURE_OPENAI_TEXT_VERBOSITY")

    if max_output_tokens:
        try:
            value = int(max_output_tokens)
        except ValueError as exc:
            raise RuntimeError("AZURE_OPENAI_MAX_OUTPUT_TOKENS must be an integer.") from exc
        if value <= 0:
            raise RuntimeError("AZURE_OPENAI_MAX_OUTPUT_TOKENS must be greater than 0.")
        options["max_output_tokens"] = value

    reasoning: dict[str, str] = {}
    if reasoning_effort:
        reasoning["effort"] = _normalize_enum(
            "AZURE_OPENAI_REASONING_EFFORT",
            reasoning_effort,
            ("none", "minimal", "low", "medium", "high", "xhigh"),
        )
    if reasoning_summary:
        reasoning["summary"] = _normalize_enum(
            "AZURE_OPENAI_REASONING_SUMMARY",
            reasoning_summary,
            ("auto", "concise", "detailed"),
        )
    if reasoning:
        options["reasoning"] = reasoning

    if text_verbosity:
        options["text"] = {
            "verbosity": _normalize_enum(
                "AZURE_OPENAI_TEXT_VERBOSITY",
                text_verbosity,
                ("low", "medium", "high"),
            )
        }

    return options


def _resolve_deployment_name() -> str:
    return os.getenv("AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME", "gpt-5.2")


def _derive_responses_base_url(endpoint: str) -> str:
    normalized = endpoint.strip()
    if not normalized:
        raise RuntimeError("AZURE_OPENAI_ENDPOINT must not be empty when provided.")
    if normalized.endswith("/openai/v1/"):
        return normalized
    if normalized.endswith("/openai/v1"):
        return f"{normalized}/"
    return f"{normalized.rstrip('/')}/openai/v1/"


def _build_responses_client() -> AzureOpenAIResponsesClient:
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    base_url = os.getenv("AZURE_OPENAI_BASE_URL")
    if endpoint is not None:
        endpoint = endpoint.strip() or None
    if base_url is not None:
        base_url = base_url.strip() or None
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "preview")
    deployment_name = _resolve_deployment_name()
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    ad_token = os.getenv("AZURE_OPENAI_AD_TOKEN")
    token_endpoint = os.getenv("AZURE_OPENAI_TOKEN_ENDPOINT")
    instruction_role = os.getenv("AZURE_OPENAI_INSTRUCTION_ROLE")
    env_file_path = os.getenv("AZURE_OPENAI_ENV_FILE_PATH")
    env_file_encoding = os.getenv("AZURE_OPENAI_ENV_FILE_ENCODING")
    default_headers_raw = os.getenv("AZURE_OPENAI_DEFAULT_HEADERS_JSON")

    if not endpoint and not base_url:
        raise RuntimeError("Either AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_BASE_URL is required.")

    # Agent Framework may build a deployment-scoped base URL from endpoint-only config.
    # For Responses API we want the v1 base URL when no explicit base_url is supplied.
    if endpoint and not base_url:
        base_url = _derive_responses_base_url(endpoint)

    default_headers: Mapping[str, str] | None = None
    if default_headers_raw and default_headers_raw.strip():
        try:
            parsed = json.loads(default_headers_raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError("AZURE_OPENAI_DEFAULT_HEADERS_JSON must be valid JSON.") from exc
        if not isinstance(parsed, dict) or not all(
            isinstance(key, str) and isinstance(value, str) for key, value in parsed.items()
        ):
            raise RuntimeError(
                "AZURE_OPENAI_DEFAULT_HEADERS_JSON must be a JSON object of string keys and values."
            )
        default_headers = parsed

    client_kwargs: dict[str, Any] = {
        "deployment_name": deployment_name,
        "api_version": api_version,
    }

    if endpoint:
        client_kwargs["endpoint"] = endpoint
    if base_url:
        client_kwargs["base_url"] = base_url
    if token_endpoint:
        client_kwargs["token_endpoint"] = token_endpoint
    if instruction_role:
        client_kwargs["instruction_role"] = instruction_role
    if env_file_path:
        client_kwargs["env_file_path"] = env_file_path
    if env_file_encoding:
        client_kwargs["env_file_encoding"] = env_file_encoding
    if default_headers:
        client_kwargs["default_headers"] = default_headers

    if api_key:
        client_kwargs["api_key"] = api_key
    elif ad_token:
        client_kwargs["ad_token"] = ad_token
    else:
        client_kwargs["credential"] = AzureCliCredential()

    return AzureOpenAIResponsesClient(**client_kwargs)


@lru_cache(maxsize=1)
def get_agent() -> Any:
    client = _build_responses_client()
    agent_kwargs = {
        "name": "PromptEnhancer",
        "instructions": PROMPT_ENHANCER_INSTRUCTIONS,
        "tools": _build_agent_tools(),
    }

    as_agent = getattr(client, "as_agent", None)
    if callable(as_agent):
        return as_agent(**agent_kwargs)

    # Backward-compat fallback for older agent-framework-core releases.
    create_agent = getattr(client, "create_agent", None)
    if callable(create_agent):
        try:
            return create_agent(**agent_kwargs)
        except TypeError:
            # Some legacy versions used positional parameters for these fields.
            return create_agent(
                agent_kwargs["name"],
                agent_kwargs["instructions"],
                agent_kwargs["tools"],
            )

    raise RuntimeError(
        "Installed agent-framework-core client does not provide as_agent/create_agent. "
        "Upgrade agent-framework-core to a supported version."
    )


def _validate_service_token(header_token: str | None) -> None:
    expected_token = os.getenv("AGENT_SERVICE_TOKEN")
    if expected_token and header_token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid or missing service token.")


def _encode_sse(payload: Mapping[str, object]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _stream_sse(prompt: str) -> AsyncIterator[str]:
    agent = get_agent()
    message = f"Please enhance this prompt:\n\n{prompt}"
    run_options = _build_run_options()
    thread_id = f"thread_{uuid4().hex}"
    turn_id = f"turn_{uuid4().hex}"
    user_prompt_item_id = f"item_{uuid4().hex}"
    enhancement_item_id = f"item_{uuid4().hex}"
    accumulated: list[str] = []

    try:
        yield _encode_sse(
            {
                "event": "thread/started",
                "type": "thread/started",
                "thread_id": thread_id,
            }
        )
        yield _encode_sse(
            {
                "event": "turn/started",
                "type": "response.created",
                "turn_id": turn_id,
                "thread_id": thread_id,
                "kind": "enhance",
            }
        )
        yield _encode_sse(
            {
                "event": "item/started",
                "type": "response.output_item.added",
                "turn_id": turn_id,
                "thread_id": thread_id,
                "item_id": user_prompt_item_id,
                "item_type": "user_prompt",
                "item": {
                    "id": user_prompt_item_id,
                    "type": "user_prompt",
                },
            }
        )
        yield _encode_sse(
            {
                "event": "item/completed",
                "type": "response.output_item.done",
                "turn_id": turn_id,
                "thread_id": thread_id,
                "item_id": user_prompt_item_id,
                "item_type": "user_prompt",
                "payload": {"text": prompt},
                "item": {
                    "id": user_prompt_item_id,
                    "type": "user_prompt",
                    "text": prompt,
                },
            }
        )
        yield _encode_sse(
            {
                "event": "item/started",
                "type": "response.output_item.added",
                "turn_id": turn_id,
                "thread_id": thread_id,
                "item_id": enhancement_item_id,
                "item_type": "enhancement",
                "item": {
                    "id": enhancement_item_id,
                    "type": "enhancement",
                },
            }
        )

        async for chunk in agent.run_stream(message, options=run_options):
            text = getattr(chunk, "text", None)
            if not text:
                continue
            accumulated.append(text)

            # Emit an event envelope plus Chat Completions-compatible delta in one payload.
            payload = {
                "event": "item/agent_message/delta",
                "type": "response.output_text.delta",
                "turn_id": turn_id,
                "thread_id": thread_id,
                "item_id": enhancement_item_id,
                "item_type": "agent_message",
                "delta": text,
                "choices": [{"delta": {"content": text}}],
            }
            yield _encode_sse(payload)

        final_text = "".join(accumulated)
        yield _encode_sse(
            {
                "event": "item/completed",
                "type": "response.output_text.done",
                "turn_id": turn_id,
                "thread_id": thread_id,
                "item_id": enhancement_item_id,
                "item_type": "agent_message",
                "payload": {"text": final_text},
                "text": final_text,
                "output_text": final_text,
            }
        )
        yield _encode_sse(
            {
                "event": "turn/completed",
                "type": "response.completed",
                "turn_id": turn_id,
                "thread_id": thread_id,
                "response": {
                    "id": turn_id,
                    "status": "completed",
                },
            }
        )
        yield "data: [DONE]\n\n"
    except Exception as exc:  # pragma: no cover - defensive streaming fallback
        error_payload = {
            "event": "turn/error",
            "type": "turn/error",
            "turn_id": turn_id,
            "thread_id": thread_id,
            "error": str(exc),
        }
        yield _encode_sse(error_payload)
        yield "data: [DONE]\n\n"


app = FastAPI(title="Prompt Enhancer Agent Service", version="1.0.0")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(ok=True, deployment=_resolve_deployment_name())


@app.post("/enhance")
async def enhance(
    body: EnhanceRequest,
    x_agent_token: str | None = Header(default=None),
) -> StreamingResponse:
    _validate_service_token(x_agent_token)

    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required.")

    if len(prompt) > MAX_PROMPT_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Prompt is too large. Maximum {MAX_PROMPT_CHARS} characters.",
        )

    # Validate configuration before starting the stream so config errors are returned as JSON.
    try:
        get_agent()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return StreamingResponse(
        _stream_sse(prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
