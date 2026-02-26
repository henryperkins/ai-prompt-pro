import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  isPayloadTooLargeError,
  readBodyJsonWithLimit,
} from "../../agent_service/http-body.mjs";

type MockRequest = Readable & {
  headers: Record<string, string | string[] | undefined>;
};

function createMockRequest(
  chunks: Array<string | Buffer>,
  headers: Record<string, string | string[] | undefined> = {},
): MockRequest {
  const req = new Readable({ read() {} }) as MockRequest;
  req.headers = headers;
  queueMicrotask(() => {
    for (const chunk of chunks) {
      req.push(chunk);
    }
    req.push(null);
  });
  return req;
}

describe("http-body helpers", () => {
  it("parses JSON payloads within max bytes", async () => {
    const req = createMockRequest(['{"prompt":"improve this"}']);
    await expect(readBodyJsonWithLimit(req, { maxBytes: 1024 })).resolves.toEqual({
      prompt: "improve this",
    });
  });

  it("returns empty object for empty request body", async () => {
    const req = createMockRequest(["   "]);
    await expect(readBodyJsonWithLimit(req, { maxBytes: 1024 })).resolves.toEqual({});
  });

  it("throws invalid JSON errors for malformed payloads", async () => {
    const req = createMockRequest(['{"prompt":']);
    await expect(readBodyJsonWithLimit(req, { maxBytes: 1024 })).rejects.toThrow("Invalid JSON body.");
  });

  it("rejects oversized payloads based on content-length header", async () => {
    const req = createMockRequest([], { "content-length": "4096" });
    await expect(readBodyJsonWithLimit(req, { maxBytes: 32 })).rejects.toMatchObject({
      code: "payload_too_large",
      statusCode: 413,
    });
  });

  it("rejects oversized payloads while streaming chunked data", async () => {
    const req = createMockRequest(["1234567890", "abcdef"]);
    try {
      await readBodyJsonWithLimit(req, { maxBytes: 8 });
      throw new Error("Expected payload_too_large error");
    } catch (error) {
      expect(isPayloadTooLargeError(error)).toBe(true);
      expect(error).toMatchObject({
        code: "payload_too_large",
        statusCode: 413,
      });
    }
  });
});
