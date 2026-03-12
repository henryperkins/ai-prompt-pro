/**
 * Codex SDK retry logic with exponential backoff for 429 rate-limit errors.
 *
 * Both streamed and buffered Codex turns are retried transparently when the
 * upstream provider returns a 429, as long as no user-visible output has been
 * emitted yet (determined by the prelude-event filter).
 *
 * @module codex-retry
 */

import { cleanLogFields, logEvent } from "./logging.mjs";
import {
  hasOnlyRetrySafeCodexPreludeEvents,
  isRetrySafeCodexPreludeEvent,
} from "./codex-stream-prelude.mjs";
import { isRateLimitMessage } from "./stream-errors.mjs";
import {
  isAbortLikeError,
  sleepWithSignal,
  throwIfAborted,
} from "./request-abort-utils.mjs";

// ---------------------------------------------------------------------------
// Rate-limit detection
// ---------------------------------------------------------------------------

/**
 * Check whether an error is a 429 rate-limit error.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isRateLimitError(err) {
  if (!err) return false;
  const status = err.status ?? err.statusCode ?? err.response?.status ?? err.cause?.status ?? err.cause?.statusCode ?? err.cause?.response?.status;
  if (status === 429) return true;

  const code = err.code ?? err.cause?.code;
  if (code === 429 || code === "rate_limit_exceeded") return true;

  const msg = String(err.message ?? err.cause?.message ?? "");
  return /(^|\b)429(\b|$)|rate.limit|too many requests|throttl/i.test(msg);
}

/**
 * Check whether a Codex `turn.failed` event is a rate-limit failure.
 *
 * @param {unknown} event
 * @returns {boolean}
 */
export function isRateLimitTurnFailure(event) {
  if (event?.type !== "turn.failed") return false;
  const msg = event.error?.message ?? "";
  return isRateLimitMessage(msg);
}

// ---------------------------------------------------------------------------
// Buffered event replay
// ---------------------------------------------------------------------------

/**
 * Yield buffered events first, then continue consuming the async iterator.
 *
 * @param {unknown[]} bufferedEvents
 * @param {AsyncIterator} iterator
 */
export async function* replayBufferedEvents(bufferedEvents, iterator) {
  for (const event of bufferedEvents) {
    yield event;
  }

  while (true) {
    const next = await iterator.next();
    if (next.done) break;
    yield next.value;
  }
}

// ---------------------------------------------------------------------------
// Streamed turn with retry
// ---------------------------------------------------------------------------

/**
 * Run a Codex streamed turn with automatic 429 retry.
 *
 * @param {object} thread
 * @param {string} input
 * @param {object} turnOptions
 * @param {{ requestContext?: object; maxRetries: number; backoffBaseSeconds: number; backoffMaxSeconds: number }} telemetry
 * @returns {Promise<{ events: AsyncIterable<unknown> }>}
 */
export async function runStreamedWithRetry(thread, input, turnOptions, telemetry = {}) {
  const { requestContext, maxRetries = 2, backoffBaseSeconds = 1, backoffMaxSeconds = 20 } = telemetry;
  const retrySignal = turnOptions?.signal;
  let attempt = 0;
  retryLoop: while (true) {
    let retryBlocked = false;
    try {
      throwIfAborted(retrySignal);
      const { events } = await thread.runStreamed(input, turnOptions);
      const iterator = events[Symbol.asyncIterator]();
      const bufferedEvents = [];

      while (true) {
        const next = await iterator.next();
        if (next.done) {
          return { events: replayBufferedEvents(bufferedEvents, iterator) };
        }

        const event = next.value;
        if (
          isRateLimitTurnFailure(event)
          && hasOnlyRetrySafeCodexPreludeEvents(bufferedEvents)
          && attempt < maxRetries
        ) {
          if (typeof iterator.return === "function") {
            await iterator.return().catch(() => undefined);
          }
          const backoff = backoffBaseSeconds * (2 ** attempt);
          const jitter = 0.5 + Math.random() * 0.5;
          const delay = Math.min(backoff * jitter, backoffMaxSeconds) * 1000;
          if (requestContext) {
            requestContext.retryCount = attempt + 1;
          }
          logEvent("warn", "retry_attempt", cleanLogFields({
            request_id: requestContext?.requestId,
            endpoint: requestContext?.endpoint,
            method: requestContext?.method,
            transport: requestContext?.transport,
            retry_count: attempt + 1,
            max_retries: maxRetries,
            error_code: "rate_limited",
            backoff_ms: Math.round(delay),
            source: "codex_turn_failed",
          }));
          await sleepWithSignal(delay, retrySignal);
          attempt++;
          continue retryLoop;
        }

        bufferedEvents.push(event);
        if (!isRetrySafeCodexPreludeEvent(event)) {
          retryBlocked = true;
          return { events: replayBufferedEvents(bufferedEvents, iterator) };
        }
      }
    } catch (err) {
      if (retryBlocked || !isRateLimitError(err) || attempt >= maxRetries) {
        throw err;
      }
      const backoff = backoffBaseSeconds * (2 ** attempt);
      const jitter = 0.5 + Math.random() * 0.5;
      const delay = Math.min(backoff * jitter, backoffMaxSeconds) * 1000;
      if (requestContext) {
        requestContext.retryCount = attempt + 1;
      }
      logEvent("warn", "retry_attempt", cleanLogFields({
        request_id: requestContext?.requestId,
        endpoint: requestContext?.endpoint,
        method: requestContext?.method,
        transport: requestContext?.transport,
        retry_count: attempt + 1,
        max_retries: maxRetries,
        error_code: "rate_limited",
        backoff_ms: Math.round(delay),
        source: "codex_exception",
      }));
      await sleepWithSignal(delay, retrySignal);
      attempt++;
    }
  }
}

// ---------------------------------------------------------------------------
// Buffered turn with retry
// ---------------------------------------------------------------------------

/**
 * Run a Codex buffered (non-streaming) turn with automatic 429 retry.
 *
 * @param {object} thread
 * @param {string} input
 * @param {object} turnOptions
 * @param {{ requestContext?: object; maxRetries: number; backoffBaseSeconds: number; backoffMaxSeconds: number }} telemetry
 * @returns {Promise<object>}
 */
export async function runBufferedWithRetry(thread, input, turnOptions, telemetry = {}) {
  const { requestContext, maxRetries = 2, backoffBaseSeconds = 1, backoffMaxSeconds = 20 } = telemetry;
  const retrySignal = turnOptions?.signal;
  let attempt = 0;

  while (true) {
    try {
      throwIfAborted(retrySignal);
      return await thread.run(input, turnOptions);
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }

      const backoff = backoffBaseSeconds * (2 ** attempt);
      const jitter = 0.5 + Math.random() * 0.5;
      const delay = Math.min(backoff * jitter, backoffMaxSeconds) * 1000;
      if (requestContext) {
        requestContext.retryCount = attempt + 1;
      }
      logEvent("warn", "retry_attempt", cleanLogFields({
        request_id: requestContext?.requestId,
        endpoint: requestContext?.endpoint,
        method: requestContext?.method,
        transport: requestContext?.transport,
        retry_count: attempt + 1,
        max_retries: maxRetries,
        error_code: "rate_limited",
        backoff_ms: Math.round(delay),
        source: "codex_buffered_run",
      }));
      await sleepWithSignal(delay, retrySignal);
      attempt++;
    }
  }
}
