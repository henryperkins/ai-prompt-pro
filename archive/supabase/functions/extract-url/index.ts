import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  applyRateLimit,
  getClientIp,
  jsonResponse,
  requireAuthenticatedUser,
  resolveCors,
} from "../_shared/security.ts";

const MAX_URL_CHARS = Number(Deno.env.get("MAX_URL_CHARS") || "2048");
const EXTRACT_PER_MINUTE = Number(Deno.env.get("EXTRACT_PER_MINUTE") || "6");
const EXTRACT_PER_DAY = Number(Deno.env.get("EXTRACT_PER_DAY") || "120");
const FETCH_TIMEOUT_MS = Number(Deno.env.get("EXTRACT_FETCH_TIMEOUT_MS") || "15000");
const MAX_RESPONSE_BYTES = Number(Deno.env.get("EXTRACT_MAX_RESPONSE_BYTES") || String(1024 * 1024));

const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "application/xml",
  "text/xml",
];

function isPrivateHost(hostname: string): boolean {
  // Block well-known metadata endpoints
  if (
    hostname === "metadata.google.internal" ||
    hostname === "metadata.google" ||
    hostname.endsWith(".internal")
  ) {
    return true;
  }

  // IPv6
  const bare = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (bare === "::1" || bare === "::" || bare.startsWith("fe80:") || bare.startsWith("fc00:") || bare.startsWith("fd")) {
    return true;
  }

  // IPv4
  const ipv4Match = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 127) return true;                         // 127.0.0.0/8 loopback
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 link-local / cloud metadata
    if (a === 0) return true;                           // 0.0.0.0/8
    return false;
  }

  // Hostnames resolving to localhost
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }

  return false;
}

function hasAllowedContentType(resp: Response): boolean {
  const ct = resp.headers.get("content-type") || "";
  const mime = ct.split(";")[0].trim().toLowerCase();
  return ALLOWED_CONTENT_TYPES.some((allowed) => mime === allowed);
}

async function readBodyWithLimit(resp: Response, maxBytes: number): Promise<string> {
  if (!resp.body) return "";

  const contentLength = resp.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    resp.body.cancel();
    throw new Error(`Response too large (${contentLength} bytes).`);
  }

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      reader.cancel();
      throw new Error("Response too large.");
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  return chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
}

function stripHtml(html: string): string {
  // Remove script and style blocks entirely
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractTitle(html: string, url: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 120);
  }
  try {
    return new URL(url).hostname;
  } catch {
    return "Extracted content";
  }
}

function parseInputUrl(input: string): URL | null {
  if (!input.trim()) return null;
  const candidate = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.message.toLowerCase().includes("timed out");
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
      scope: "extract-minute",
      key: `${auth.userId}:${clientIp}`,
      limit: EXTRACT_PER_MINUTE,
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
      scope: "extract-day",
      key: dailyKey,
      limit: EXTRACT_PER_DAY,
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

    const rawUrl = (body as { url?: unknown })?.url;
    const urlInput = typeof rawUrl === "string" ? rawUrl.trim() : "";

    if (!urlInput) {
      return jsonResponse({ error: "A valid URL is required." }, 400, cors.headers);
    }
    if (urlInput.length > MAX_URL_CHARS) {
      return jsonResponse(
        { error: `URL is too large. Maximum ${MAX_URL_CHARS} characters.` },
        413,
        cors.headers,
      );
    }

    const parsedUrl = parseInputUrl(urlInput);
    if (!parsedUrl) {
      return jsonResponse({ error: "Invalid URL format." }, 400, cors.headers);
    }

    if (isPrivateHost(parsedUrl.hostname)) {
      return jsonResponse({ error: "URLs pointing to private or internal hosts are not allowed." }, 400, cors.headers);
    }

    console.log("Fetching URL:", parsedUrl.href);

    let pageResp: Response;
    try {
      pageResp = await fetch(parsedUrl.href, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PromptForge/1.0; +https://promptforge.app)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        return jsonResponse(
          { error: "Timed out while fetching the URL." },
          504,
          cors.headers,
        );
      }
      throw error;
    }

    if (!pageResp.ok) {
      console.error("Failed to fetch URL:", pageResp.status);
      return jsonResponse(
        { error: `Could not fetch URL (status ${pageResp.status})` },
        422,
        cors.headers,
      );
    }

    if (!hasAllowedContentType(pageResp)) {
      return jsonResponse(
        { error: "URL did not return an HTML or text content type." },
        422,
        cors.headers,
      );
    }

    let html: string;
    try {
      html = await readBodyWithLimit(pageResp, MAX_RESPONSE_BYTES);
    } catch {
      return jsonResponse(
        { error: "Response body is too large to process." },
        413,
        cors.headers,
      );
    }
    const title = extractTitle(html, parsedUrl.href);
    let plainText = stripHtml(html);

    // Truncate to ~8000 chars to stay within token budget
    if (plainText.length > 8000) {
      plainText = plainText.slice(0, 8000) + "…";
    }

    if (plainText.length < 50) {
      return jsonResponse(
        { error: "Page had too little readable text content." },
        422,
        cors.headers,
      );
    }

    console.log("Extracted text length:", plainText.length, "| Title:", title);

    // Send to AI gateway for extraction
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let aiResp: Response;
    try {
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are a content extractor. Given raw text from a web page, extract the 5-10 most important and relevant points as concise bullet points. Focus on facts, data, and key claims. Omit navigation text, ads, and boilerplate. Return only the bullet points, one per line, prefixed with a bullet character (•).",
            },
            {
              role: "user",
              content: `Extract the key points from this page:\n\n${plainText}`,
            },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        return jsonResponse(
          { error: "Timed out while extracting content." },
          504,
          cors.headers,
        );
      }
      throw error;
    }

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);

      if (aiResp.status === 429) {
        return jsonResponse(
          { error: "Rate limit exceeded. Please try again in a moment." },
          429,
          cors.headers,
        );
      }
      if (aiResp.status === 402) {
        return jsonResponse(
          { error: "AI credits depleted. Please add funds to continue." },
          402,
          cors.headers,
        );
      }

      return jsonResponse(
        { error: "Failed to extract content from the page." },
        500,
        cors.headers,
      );
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    console.log("Extraction complete, content length:", content.length);

    return jsonResponse({ title, content }, 200, cors.headers);
  } catch (e) {
    console.error("extract-url error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
      cors.headers,
    );
  }
});
