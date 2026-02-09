import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let bootstrapTokenPromise: Promise<string> | null = null;

function assertSupabaseEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase environment variables are missing.");
  }
}

function functionUrl(name: "enhance-prompt" | "extract-url"): string {
  assertSupabaseEnv();
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function getAccessToken(): Promise<string> {
  assertSupabaseEnv();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Could not read auth session: ${sessionError.message}`);
  }
  if (session?.access_token) {
    return session.access_token;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session?.access_token) {
    throw new Error(
      error?.message ||
        "Authentication required. Enable anonymous sign-ins or sign in before using AI features.",
    );
  }
  return data.session.access_token;
}

async function getAccessTokenWithBootstrap(): Promise<string> {
  if (!bootstrapTokenPromise) {
    bootstrapTokenPromise = getAccessToken().finally(() => {
      bootstrapTokenPromise = null;
    });
  }
  return bootstrapTokenPromise;
}

async function functionHeaders(): Promise<Record<string, string>> {
  assertSupabaseEnv();
  const accessToken = await getAccessTokenWithBootstrap();
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY as string,
    Authorization: `Bearer ${accessToken}`,
  };
}

function extractSseError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as { error?: unknown };
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  if (data.error && typeof data.error === "object") {
    const message = (data.error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return null;
}

function extractSseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    choices?: Array<{ delta?: { content?: unknown } }>;
    type?: unknown;
    delta?: unknown;
    output_text?: unknown;
  };

  const chatCompletionsDelta = data.choices?.[0]?.delta?.content;
  if (typeof chatCompletionsDelta === "string" && chatCompletionsDelta) {
    return chatCompletionsDelta;
  }

  // Responses API streaming event shape.
  if (data.type === "response.output_text.delta" && typeof data.delta === "string" && data.delta) {
    return data.delta;
  }

  // Fallback for any adapter that emits output_text directly.
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  return null;
}

export async function streamEnhance({
  prompt,
  onDelta,
  onDone,
  onError,
}: {
  prompt: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const headers = await functionHeaders();
    const resp = await fetch(functionUrl("enhance-prompt"), {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ error: "Enhancement failed" }));
      onError(errorData.error || `Error: ${resp.status}`);
      return;
    }

    if (!resp.body) {
      onError("No response body");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let terminalError: string | null = null;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const parsedError = extractSseError(parsed);
          if (parsedError) {
            terminalError = parsedError;
            streamDone = true;
            break;
          }

          const content = extractSseText(parsed);
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (terminalError) {
      onError(terminalError);
      return;
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const parsedError = extractSseError(parsed);
          if (parsedError) {
            terminalError = parsedError;
            break;
          }
          const content = extractSseText(parsed);
          if (content) onDelta(content);
        } catch {
          /* ignore */
        }
      }
    }

    if (terminalError) {
      onError(terminalError);
      return;
    }

    onDone();
  } catch (e) {
    console.error("Stream error:", e);
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}

export async function extractUrl(url: string): Promise<{ title: string; content: string }> {
  const headers = await functionHeaders();
  const resp = await fetch(functionUrl("extract-url"), {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: "Extraction failed" }));
    throw new Error(errorData.error || `Error: ${resp.status}`);
  }

  return resp.json();
}
