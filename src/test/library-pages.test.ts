import { describe, expect, it } from "vitest";
import {
  decodeSelectionIds,
  encodeSelectionIds,
  getInitials,
  getUserAvatarUrl,
  getUserDisplayName,
} from "@/lib/library-pages";

describe("library page helpers", () => {
  it("encodes and decodes bulk selection ids", () => {
    const params = encodeSelectionIds(["a", "b", "a", " ", "c"]);
    expect(params.toString()).toBe("id=a&id=b&id=c");
    expect(decodeSelectionIds(params)).toEqual(["a", "b", "c"]);
  });

  it("derives display name and avatar from user metadata", () => {
    const user = {
      email: "dev@example.com",
      user_metadata: {
        display_name: "Prompt Dev",
        full_name: "Prompt Developer",
        avatar_url: "https://example.com/avatar.png",
      },
    } as unknown;

    expect(getUserDisplayName(user as never)).toBe("Prompt Dev");
    expect(getUserAvatarUrl(user as never)).toBe("https://example.com/avatar.png");
    expect(getInitials("Prompt Dev")).toBe("PD");
  });

  it("falls back cleanly when user metadata is missing", () => {
    expect(getUserDisplayName(null)).toBe("Guest");
    expect(getUserAvatarUrl(null)).toBeNull();
    expect(getInitials("single")).toBe("SI");
    expect(getInitials("")).toBe("?");
  });
});
