import { describe, expect, it } from "vitest";
import { toCommunityErrorState } from "@/lib/community-errors";

describe("toCommunityErrorState", () => {
  describe("classifies error kinds correctly", () => {
    it("classifies permission errors as auth", () => {
      const state = toCommunityErrorState(
        new Error("permission denied for table community_posts"),
        "Fallback",
      );
      expect(state.kind).toBe("auth");
    });

    it("classifies network errors", () => {
      const state = toCommunityErrorState(new Error("Failed to fetch"), "Fallback");
      expect(state.kind).toBe("network");
    });

    it("classifies not_found errors", () => {
      const state = toCommunityErrorState(new Error("Post not found"), "Fallback");
      expect(state.kind).toBe("not_found");
    });

    it("classifies invalid input (UUID) as not_found", () => {
      const state = toCommunityErrorState(
        new Error("This profile link is invalid or expired."),
        "Fallback",
      );
      expect(state.kind).toBe("not_found");
    });

    it("classifies invalid input syntax as not_found", () => {
      const state = toCommunityErrorState(
        new Error("invalid input syntax for type uuid: 'test-user'"),
        "Fallback",
      );
      expect(state.kind).toBe("not_found");
    });

    it("classifies backend_unconfigured", () => {
      const state = toCommunityErrorState(
        new Error("backend is not configured"),
        "Fallback",
      );
      expect(state.kind).toBe("backend_unconfigured");
    });

    it("falls back to unknown for unrecognized messages", () => {
      const state = toCommunityErrorState(new Error("Something strange"), "Fallback");
      expect(state.kind).toBe("unknown");
    });
  });

  describe("uses fallback for non-Error inputs", () => {
    it("returns fallback message for plain strings", () => {
      const state = toCommunityErrorState("raw string", "Fallback message");
      expect(state.message).toBe("Fallback message");
    });

    it("returns fallback message for null", () => {
      const state = toCommunityErrorState(null, "Fallback message");
      expect(state.message).toBe("Fallback message");
    });

    it("returns fallback message for undefined", () => {
      const state = toCommunityErrorState(undefined, "Fallback message");
      expect(state.message).toBe("Fallback message");
    });
  });
});
