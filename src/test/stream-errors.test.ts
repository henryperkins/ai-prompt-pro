import { describe, expect, it } from "vitest";
import {
  classifyStreamFailure,
  resolveRequestCompletionStatus,
} from "../../agent_service/stream-errors.mjs";

describe("classifyStreamFailure", () => {
  it("maps rate limit messages to structured failure metadata", () => {
    expect(classifyStreamFailure({ message: "429 Too Many Requests" }, {
      defaultCode: "service_error",
      defaultStatus: 503,
    })).toEqual({
      message: "429 Too Many Requests",
      code: "rate_limited",
      status: 429,
    });
  });

  it("preserves explicit status and error codes from upstream failures", () => {
    expect(classifyStreamFailure({
      message: "Sign in required.",
      code: "auth.required",
      status: 401,
    }, {
      defaultCode: "service_error",
      defaultStatus: 503,
    })).toEqual({
      message: "Sign in required.",
      code: "auth_required",
      status: 401,
    });
  });

  it("preserves unsafe_url failures as machine-readable client codes", () => {
    expect(classifyStreamFailure({
      message: "URLs pointing to private or internal hosts are not allowed.",
      code: "unsafe_url",
      status: 400,
    }, {
      defaultCode: "service_error",
      defaultStatus: 503,
    })).toEqual({
      message: "URLs pointing to private or internal hosts are not allowed.",
      code: "unsafe_url",
      status: 400,
    });
  });

  it("maps request_aborted errors to a non-500 client termination code", () => {
    expect(classifyStreamFailure({
      message: "Client disconnected.",
      code: "request_aborted",
    }, {
      defaultCode: "service_error",
      defaultStatus: 503,
    })).toEqual({
      message: "Client disconnected.",
      code: "request_aborted",
      status: 499,
    });
  });

  it("falls back to service_error when upstream metadata is missing", () => {
    expect(classifyStreamFailure({ message: "Codex worker failed." }, {
      defaultCode: "service_error",
      defaultStatus: 503,
    })).toEqual({
      message: "Codex worker failed.",
      code: "service_error",
      status: 503,
    });
  });
});

describe("resolveRequestCompletionStatus", () => {
  it("prefers stored request status over transport 200 for stream failures", () => {
    expect(resolveRequestCompletionStatus({
      transportStatusCode: 200,
      requestStatusCode: 429,
      errorCode: "rate_limited",
    })).toBe(429);
  });

  it("falls back to the transport status for successful responses", () => {
    expect(resolveRequestCompletionStatus({
      transportStatusCode: 200,
      requestStatusCode: undefined,
      errorCode: undefined,
    })).toBe(200);
  });
});
