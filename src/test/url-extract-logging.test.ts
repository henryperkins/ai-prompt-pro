import { describe, expect, it } from "vitest";

import { sanitizeUrlForLogs } from "../../agent_service/url-extract.mjs";

describe("extract-url log sanitization", () => {
  it("removes credentials, query params, and fragments", () => {
    expect(
      sanitizeUrlForLogs(
        "https://user:secret@example.com/path/to/page?token=abc123&sig=xyz#section-2",
      ),
    ).toBe("https://example.com/path/to/page");
  });

  it("returns undefined for invalid urls", () => {
    expect(sanitizeUrlForLogs("not a url")).toBeUndefined();
  });
});
