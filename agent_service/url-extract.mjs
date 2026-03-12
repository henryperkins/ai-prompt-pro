/**
 * URL content extraction: fetching, HTML parsing, summarization, and caching.
 *
 * Isolates the `/extract-url` business logic so `codex_service.mjs` only
 * needs to call a single `fetchAndSummarizeUrl()` orchestrator.
 *
 * @module url-extract
 */

import {
  assertPublicHttpTarget,
  createUrlNotAllowedError,
  isRedirectStatus,
} from "./network-security.mjs";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const TEXTUAL_CONTENT_TYPES = new Set([
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "application/json",
  "application/ld+json",
  "application/rss+xml",
  "application/atom+xml",
  "application/javascript",
  "application/x-javascript",
  "application/ecmascript",
]);

// ---------------------------------------------------------------------------
// Abort-controller tracking (shared with service)
// ---------------------------------------------------------------------------

/** @type {Set<AbortController>} */
let _activeAbortControllers;

/**
 * Bind the module to the service's shared abort-controller set.
 *
 * @param {Set<AbortController>} controllers
 */
export function bindAbortControllers(controllers) {
  _activeAbortControllers = controllers;
}

function trackAbortController(controller) {
  _activeAbortControllers?.add(controller);
  return controller;
}

function untrackAbortController(controller) {
  _activeAbortControllers?.delete(controller);
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = trackAbortController(new AbortController());
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    untrackAbortController(controller);
  }
}

/**
 * Follow redirects manually, re-validating each hop is a public target.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs
 * @param {number} maxRedirects
 * @returns {Promise<Response>}
 */
export async function fetchWithSafeRedirects(url, options, timeoutMs, maxRedirects = 5) {
  let currentUrl = url;
  let redirectCount = 0;

  while (true) {
    await assertPublicHttpTarget(currentUrl);
    const response = await fetchWithTimeout(
      currentUrl,
      { ...options, redirect: "manual" },
      timeoutMs,
    );

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) return response;

    if (redirectCount >= maxRedirects) {
      await response.body?.cancel().catch(() => undefined);
      throw createUrlNotAllowedError(
        `Too many redirects while fetching URL. Maximum ${maxRedirects} redirects allowed.`,
      );
    }

    const nextUrl = new URL(location, currentUrl);
    await response.body?.cancel().catch(() => undefined);
    currentUrl = nextUrl.toString();
    redirectCount += 1;
  }
}

/** @returns {Record<string, string>} */
export function buildPrimaryFetchHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; PromptForge/1.0; +https://promptforge.app)",
    Accept: "text/html,application/xhtml+xml,application/xml,text/plain,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
}

/** @returns {Record<string, string>} */
export function buildRetryFetchHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
  };
}

/**
 * Fetch a page URL, retrying with a browser-like User-Agent if the first
 * attempt returns a non-OK status.
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @param {number} maxRedirects
 * @returns {Promise<Response>}
 */
export async function fetchPageWithHeaderFallback(url, timeoutMs, maxRedirects = 5) {
  const attempts = [buildPrimaryFetchHeaders(), buildRetryFetchHeaders()];
  let lastResponse = null;
  let lastError = null;

  for (const headers of attempts) {
    try {
      const response = await fetchWithSafeRedirects(url, { headers }, timeoutMs, maxRedirects);
      if (response.ok) return response;
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (isTimeoutError(error)) throw error;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error("Failed to fetch URL.");
}

// ---------------------------------------------------------------------------
// Response reading
// ---------------------------------------------------------------------------

/**
 * Read a response body with a byte-size limit.
 *
 * @param {Response} resp
 * @param {number} maxBytes
 * @returns {Promise<string>}
 */
export async function readBodyWithLimit(resp, maxBytes) {
  if (!resp.body) return "";

  const contentLength = resp.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    await resp.body.cancel();
    throw new Error(`Response too large (${contentLength} bytes).`);
  }

  const reader = resp.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("Response too large.");
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") + decoder.decode();
}

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags and decode common entities.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/**
 * Extract the `content` attribute from the first `<meta>` tag matching a regex.
 *
 * @param {string} html
 * @param {RegExp} matcher
 * @returns {string}
 */
export function extractMetaContent(html, matcher) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    if (!matcher.test(tag)) continue;
    const contentMatch = tag.match(/\bcontent=(["'])([\s\S]*?)\1/i);
    if (contentMatch?.[2]) {
      const value = contentMatch[2].replace(/\s+/g, " ").trim();
      if (value) return value;
    }
  }
  return "";
}

/**
 * Extract the page title from HTML.
 *
 * @param {string} html
 * @param {string} url
 * @returns {string}
 */
export function extractTitle(html, url) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 120);
  }
  const ogTitle = extractMetaContent(html, /\bproperty=["']og:title["']/i);
  if (ogTitle) return ogTitle.slice(0, 120);
  const twitterTitle = extractMetaContent(html, /\bname=["']twitter:title["']/i);
  if (twitterTitle) return twitterTitle.slice(0, 120);
  try {
    return new URL(url).hostname;
  } catch {
    return "Extracted content";
  }
}

/**
 * Extract description metadata from HTML.
 *
 * @param {string} html
 * @returns {string}
 */
export function extractMetadataText(html) {
  const values = [
    extractMetaContent(html, /\bname=["']description["']/i),
    extractMetaContent(html, /\bproperty=["']og:description["']/i),
    extractMetaContent(html, /\bname=["']twitter:description["']/i),
  ].filter(Boolean);
  return values.join(" ").trim();
}

// ---------------------------------------------------------------------------
// Content classification
// ---------------------------------------------------------------------------

/**
 * Get the MIME type from a response's Content-Type header.
 *
 * @param {Response} resp
 * @returns {string}
 */
export function responseMimeType(resp) {
  const ct = resp.headers.get("content-type") || "";
  return ct.split(";")[0].trim().toLowerCase();
}

/**
 * Check whether a MIME type is text-like.
 *
 * @param {string} mimeType
 * @returns {boolean}
 */
export function isTextLikeContentType(mimeType) {
  if (!mimeType) return true;
  if (mimeType.startsWith("text/")) return true;
  return TEXTUAL_CONTENT_TYPES.has(mimeType);
}

/**
 * Check whether a MIME type is HTML-like (needs tag stripping).
 *
 * @param {string} mimeType
 * @returns {boolean}
 */
export function isHtmlLikeMimeType(mimeType) {
  return (
    !mimeType
    || mimeType === "text/html"
    || mimeType === "application/xhtml+xml"
    || mimeType === "application/xml"
    || mimeType === "text/xml"
  );
}

/**
 * Heuristic: does this text look like binary data?
 *
 * @param {string} payload
 * @returns {boolean}
 */
export function looksLikeBinaryPayload(payload) {
  if (!payload) return true;
  const sample = payload.slice(0, 4096);
  if (sample.includes("\u0000")) return true;

  let suspicious = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    const isAllowedControl = code === 9 || code === 10 || code === 13;
    if (code < 32 && !isAllowedControl) suspicious += 1;
  }

  if (sample.length === 0) return false;
  return suspicious / sample.length > 0.12;
}

/**
 * Normalise raw body text into extractable plain text.
 *
 * @param {string} rawBody
 * @param {string} mimeType
 * @returns {string}
 */
export function normalizeExtractableText(rawBody, mimeType) {
  if (!rawBody) return "";
  if (isHtmlLikeMimeType(mimeType)) {
    const htmlText = stripHtml(rawBody);
    const metadataText = extractMetadataText(rawBody);
    return [htmlText, metadataText].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  return rawBody.replace(/\s+/g, " ").trim();
}

/**
 * Clamp extracted text to a character limit.
 *
 * @param {string} text
 * @param {number} [maxChars=16000]
 * @returns {string}
 */
export function clampExtractText(text, maxChars = 16000) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

/**
 * Parse a user-supplied URL input, prepending https:// if needed.
 *
 * @param {string} input
 * @returns {URL | null}
 */
export function parseInputUrl(input) {
  if (!input.trim()) return null;
  const candidate = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Check whether an error is a timeout/abort error.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isTimeoutError(error) {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError" || error.message.toLowerCase().includes("timed out");
}

/**
 * Extract text content from an OpenAI chat-completions content field.
 *
 * @param {unknown} content
 * @returns {string}
 */
export function extractTextFromOpenAiContent(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const joined = content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      if (typeof entry.text === "string") return entry.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
  return joined.trim();
}

// ---------------------------------------------------------------------------
// Extract-URL in-memory cache
// ---------------------------------------------------------------------------

/**
 * Create a TTL-limited, size-bounded URL cache.
 *
 * @param {{ ttlMs: number; maxEntries: number }} options
 */
export function createExtractUrlCache({ ttlMs, maxEntries }) {
  /** @type {Map<string, { title: string; content: string; cachedAt: number }>} */
  const store = new Map();

  return {
    /**
     * @param {string} url
     * @returns {{ title: string; content: string } | null}
     */
    get(url) {
      const entry = store.get(url);
      if (!entry) return null;
      if (Date.now() - entry.cachedAt > ttlMs) {
        store.delete(url);
        return null;
      }
      return entry;
    },

    /**
     * @param {string} url
     * @param {string} title
     * @param {string} content
     */
    set(url, title, content) {
      // Prune expired entries
      for (const [key, entry] of store) {
        if (Date.now() - entry.cachedAt > ttlMs) {
          store.delete(key);
        }
      }
      // Evict oldest if at capacity
      if (store.size >= maxEntries) {
        const oldestKey = store.keys().next().value;
        store.delete(oldestKey);
      }
      store.set(url, { title, content, cachedAt: Date.now() });
    },
  };
}

// ---------------------------------------------------------------------------
// Summarization via OpenAI chat completions
// ---------------------------------------------------------------------------

/**
 * Summarize extracted plain text using the OpenAI chat completions API.
 *
 * @param {string} plainText
 * @param {{ apiBaseUrl: string; apiKey: string; model: string; isAzure: boolean; timeoutMs: number }} config
 * @returns {Promise<{ ok: true; content: string } | { ok: false; status: number; errorBody: string }>}
 */
export async function summarizeExtractedText(plainText, config) {
  const { apiBaseUrl, apiKey, model, isAzure, timeoutMs } = config;

  const headers = isAzure
    ? { "api-key": apiKey, "Content-Type": "application/json" }
    : { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const response = await fetchWithTimeout(
    `${apiBaseUrl.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a content extractor. Given raw text from a web page, extract the 5-10 most important and relevant points as concise bullet points. Focus on facts, data, and key claims. Omit navigation text, ads, and boilerplate. Return only bullet points, one per line, prefixed with a bullet character (•).",
          },
          {
            role: "user",
            content: `Extract the key points from this page:\n\n${plainText}`,
          },
        ],
        stream: false,
      }),
    },
    timeoutMs,
  );

  if (!response.ok) {
    return { ok: false, status: response.status, errorBody: await response.text() };
  }

  const data = await response.json().catch(() => ({}));
  const content = extractTextFromOpenAiContent(data?.choices?.[0]?.message?.content);
  return { ok: true, content };
}
