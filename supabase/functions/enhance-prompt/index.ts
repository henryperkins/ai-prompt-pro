import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  applyRateLimit,
  getClientIp,
  jsonResponse,
  requireAuthenticatedUser,
  resolveCors,
} from "../_shared/security.ts";

const MAX_PROMPT_CHARS = Number(Deno.env.get("MAX_PROMPT_CHARS") || "16000");
const ENHANCE_PER_MINUTE = Number(Deno.env.get("ENHANCE_PER_MINUTE") || "12");
const ENHANCE_PER_DAY = Number(Deno.env.get("ENHANCE_PER_DAY") || "300");
const AGENT_SERVICE_URL = Deno.env.get("AGENT_SERVICE_URL");
const AGENT_SERVICE_TOKEN = Deno.env.get("AGENT_SERVICE_TOKEN");

function normalizeAgentServiceUrl(raw: string): string {
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

serve(async (req) => {
  const cors = resolveCors(req);

  if (req.method === "OPTIONS") {
    if (!cors.ok) {
      return jsonResponse({ error: cors.error }, cors.status, cors.headers);
    }
    return new Response("ok", { headers: cors.headers });
  }

  if (!cors.ok) {
    return jsonResponse({ error: cors.error }, cors.status, cors.headers);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, cors.headers);
  }

  try {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status, cors.headers);
    }

    const clientIp = getClientIp(req);
    const minuteLimit = await applyRateLimit({
      scope: "enhance-minute",
      key: `${auth.userId}:${clientIp}`,
      limit: ENHANCE_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!minuteLimit.ok) {
      return jsonResponse(
        { error: "Rate limit exceeded. Please try again later." },
        429,
        cors.headers,
        {
          "Retry-After": String(minuteLimit.retryAfterSeconds),
        },
      );
    }

    const dailyKey = auth.isAnonymous ? `${auth.userId}:${clientIp}` : auth.userId;
    const dailyLimit = await applyRateLimit({
      scope: "enhance-day",
      key: dailyKey,
      limit: ENHANCE_PER_DAY,
      windowMs: 86_400_000,
    });
    if (!dailyLimit.ok) {
      return jsonResponse(
        { error: "Daily quota exceeded. Please try again tomorrow." },
        429,
        cors.headers,
        {
          "Retry-After": String(dailyLimit.retryAfterSeconds),
        },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400, cors.headers);
    }

    const promptRaw = (body as { prompt?: unknown })?.prompt;
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
    if (!prompt) {
      return jsonResponse({ error: "Prompt is required." }, 400, cors.headers);
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return jsonResponse(
        { error: `Prompt is too large. Maximum ${MAX_PROMPT_CHARS} characters.` },
        413,
        cors.headers,
      );
    }

    const threadIdRaw = (body as { thread_id?: unknown; threadId?: unknown })?.thread_id
      ?? (body as { thread_id?: unknown; threadId?: unknown })?.threadId;
    const threadId = typeof threadIdRaw === "string" ? threadIdRaw.trim() : "";
    if (threadIdRaw !== undefined && !threadId) {
      return jsonResponse({ error: "thread_id must be a non-empty string when provided." }, 400, cors.headers);
    }

    const threadOptionsRaw = (body as { thread_options?: unknown; threadOptions?: unknown })?.thread_options
      ?? (body as { thread_options?: unknown; threadOptions?: unknown })?.threadOptions;
    if (
      threadOptionsRaw !== undefined &&
      (!threadOptionsRaw || typeof threadOptionsRaw !== "object" || Array.isArray(threadOptionsRaw))
    ) {
      return jsonResponse({ error: "thread_options must be an object when provided." }, 400, cors.headers);
    }

    const agentPayload: Record<string, unknown> = { prompt };
    if (threadId) {
      agentPayload.thread_id = threadId;
    }
    if (threadOptionsRaw && typeof threadOptionsRaw === "object" && !Array.isArray(threadOptionsRaw)) {
      agentPayload.thread_options = threadOptionsRaw;
    }

    if (!AGENT_SERVICE_URL) {
      throw new Error("AGENT_SERVICE_URL is not configured");
    }

    const agentServiceUrl = normalizeAgentServiceUrl(AGENT_SERVICE_URL);

    console.log("Enhancing prompt, length:", prompt?.length);

    const response = await fetch(`${agentServiceUrl}/enhance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AGENT_SERVICE_TOKEN ? { "x-agent-token": AGENT_SERVICE_TOKEN } : {}),
      },
      body: JSON.stringify(agentPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const trimmedErrorText = errorText.trim();
      let errorMessage = "AI enhancement failed. Please try again.";
      try {
        const parsed = JSON.parse(errorText) as { detail?: unknown; error?: unknown };
        if (typeof parsed.detail === "string" && parsed.detail.trim()) {
          errorMessage = parsed.detail.trim();
        } else if (typeof parsed.error === "string" && parsed.error.trim()) {
          errorMessage = parsed.error.trim();
        }
      } catch {
        if (trimmedErrorText) errorMessage = trimmedErrorText;
      }

      if (
        response.status >= 500 &&
        (!errorMessage || errorMessage === "Internal Server Error")
      ) {
        errorMessage =
          "Agent service returned a 500 error. Check AGENT_SERVICE_URL and the agent service logs.";
      }

      console.error("Agent service error:", response.status, errorMessage);

      return jsonResponse(
        { error: errorMessage },
        response.status >= 400 && response.status < 600 ? response.status : 500,
        cors.headers,
      );
    }

    console.log("Streaming response back to client");

    return new Response(response.body, {
      headers: {
        ...cors.headers,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("enhance-prompt error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
      cors.headers,
    );
  }
});
