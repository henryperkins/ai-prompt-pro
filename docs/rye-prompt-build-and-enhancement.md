# Rye App Prompt Build and Enhancement Flow

This document explains how the app turns user input into:

1. a built prompt (local composition), and
2. an enhanced prompt (agent-assisted rewrite streamed back to the UI).

The flow described here reflects the current implementation in:

- `src/hooks/usePromptBuilder.ts`
- `src/lib/prompt-builder.ts`
- `src/lib/context-types.ts`
- `src/pages/Index.tsx`
- `src/lib/ai-client.ts`
- `supabase/functions/enhance-prompt/index.ts`
- `agent_service/codex_service.mjs`

## 1) User Input State Model

The app stores prompt editing state in `PromptConfig` (`src/lib/prompt-builder.ts`):

- core fields: `originalPrompt`, `task`, `role`, `customRole`, `context`
- output controls: `format`, `customFormat`, `lengthPreference`
- quality controls: `constraints`, `customConstraint`, `tone`, `complexity`
- structured context: `contextConfig` (sources, DB refs, RAG, interview answers, project notes)

`usePromptBuilder` owns this state (`src/hooks/usePromptBuilder.ts`) and handles:

- hydration from local/cloud draft
- debounced autosave
- local/cloud version history
- reset/remix/template actions

## 2) How the App Builds the Prompt (Local Composition)

`usePromptBuilder` derives:

- `builtPrompt = buildPrompt(config)`
- `score = scorePrompt(config)`

in `src/hooks/usePromptBuilder.ts`.

### Prompt assembly order

`buildPrompt(config)` in `src/lib/prompt-builder.ts` appends sections in this order:

1. `Role` (uses `customRole` first, otherwise `role`)
2. `Task` (uses `originalPrompt` first, otherwise legacy `task`)
3. `Context` block from `buildContextBlock(contextConfig, useDelimiters)`
4. fallback legacy context field if no structured context block exists
5. `Format` with length preference text
6. `Examples`
7. `Constraints` (selected + custom + non-default tone/complexity)

If no inputs are provided, the result can be an empty string.

### Structured context block behavior

`buildContextBlock` in `src/lib/context-types.ts` merges optional sections:

- `<background>` or `**Background:**`
- `<sources>` or `**Sources:**`
- `<database-connections>` or `**Database Connections:**`
- `<rag-parameters>` or `**RAG Parameters:**`
- `<project-notes>` or `**Project Notes:**`
- `<context-interview>` or `**Context Interview:**`

Delimiter tags are controlled by `contextConfig.useDelimiters`.

## 3) When Enhancement Starts in the UI

`Index` page calls `streamEnhance` in `handleEnhance` (`src/pages/Index.tsx`) when:

- `builtPrompt` is non-empty
- no enhancement is currently running

Current request includes:

- `prompt: builtPrompt`
- `threadOptions` defaults:
  - `modelReasoningEffort: "medium"`
  - `webSearchEnabled` (UI toggle, currently default `false`)

The UI streams incremental text (`onDelta`) and:

- accumulates enhanced prompt text into local `enhancedPrompt`
- if a trailing `Sources` block appears (`\n---\nSources:\n...`), splits it out into `webSearchSources` for separate rendering
- moves phase state:

- `starting` -> `streaming` -> `settling` -> `done` -> `idle`

## 4) Client Transport (`ai-client`)

`streamEnhance` in `src/lib/ai-client.ts`:

1. builds payload:
   - required: `prompt`
   - optional: `thread_id`, `thread_options`
2. sends POST to Supabase Edge Function `enhance-prompt`
3. uses auth recovery strategy:
   - session token attempt
   - forced refresh attempt
   - publishable-key fallback if session remains invalid
4. consumes SSE stream line-by-line (`data: ...`)
5. normalizes event shapes and extracts text deltas from:
   - Codex-style item delta events
   - Responses-style `response.output_text.*` events
6. invokes `onDone` when `[DONE]` is received and no terminal error was emitted

## 5) Supabase Edge Function (`enhance-prompt`)

`supabase/functions/enhance-prompt/index.ts` performs:

1. CORS and method checks
2. authenticated user requirement
3. minute and daily rate limits
4. request validation:
   - `prompt` required, trimmed, max length enforced
   - optional `thread_id` must be non-empty string
   - optional `thread_options` must be an object
   - allowed `thread_options` keys are sanitized to:
     - `modelReasoningEffort`
     - `webSearchEnabled`
5. proxy call to agent service:
   - `POST {AGENT_SERVICE_URL}/enhance`
   - includes `x-agent-token` when configured
6. pass-through of SSE response body back to browser

## 6) Codex Agent Service Enhancement Logic (Primary Backend)

`agent_service/codex_service.mjs` is the recommended backend.

### Request handling

- endpoint: `POST /enhance`
- validates `prompt` and max size
- optional `thread_id` and `thread_options` are accepted

### Thread options and controls

Service-level default thread options are configured via env (model, sandbox, network/search, approval policy, etc.).

Per-request `thread_options` accepted from caller are currently limited to:

- `modelReasoningEffort` (`minimal|low|medium|high|xhigh`)
- `webSearchEnabled`

### Enhancement instruction wrapping

The raw user-built prompt is wrapped in a service-side enhancer instruction template:

- preserve user intent/constraints
- improve clarity/specificity/structure without changing scope
- bounded ambiguity handling (`Assumptions` when required)
- conditional source citation block only when web search was used
- optional prompt-structure analysis hints (Role/Task/Context/Format/Constraints coverage)

Then sent as:

- `thread.runStreamed(buildEnhancerInput(prompt), { signal })`

### Streaming adaptation

Codex events are mapped to SSE events compatible with frontend parsers:

- thread/turn lifecycle events
- item started/updated/completed events
- text delta packets (`response.output_text.delta`)
- final text done packet (`response.output_text.done`)
- `[DONE]` terminator

## 7) End-to-End Sequence

```text
User edits builder fields
  -> usePromptBuilder updates PromptConfig
  -> buildPrompt(config) derives builtPrompt
User clicks Enhance
  -> Index.handleEnhance calls streamEnhance({ prompt, threadOptions })
  -> ai-client POST /functions/v1/enhance-prompt
  -> Supabase function validates + rate-limits + proxies to /enhance
  -> Codex service wraps prompt with enhancer instructions and runs thread
  -> Codex stream -> SSE delta events -> browser
  -> ai-client extracts text -> onDelta accumulates
  -> UI shows enhanced prompt and marks completion
```

## 8) Practical Debugging Points

If enhancement fails, check in this order:

1. Frontend request payload creation (`src/lib/ai-client.ts`)
2. Edge Function validation/rate-limit rejection (`supabase/functions/enhance-prompt/index.ts`)
3. Agent service reachability and token (`AGENT_SERVICE_URL`, `AGENT_SERVICE_TOKEN`)
4. Codex service env config and model/thread option values (`agent_service/codex_service.mjs`)

## 9) Notes for Future Changes

If you add new builder controls:

- extend `PromptConfig`
- update `buildPrompt` ordering rules
- add/adjust `scorePrompt`
- decide whether the new control should also be reflected in enhancer thread options
- add tests in `src/test/*prompt-builder*` or `src/test/ai-client-*`
