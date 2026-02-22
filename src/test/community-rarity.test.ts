import { describe, expect, it } from "vitest";
import { getCommunityPostRarity, getCommunityPostRarityClass, getLibraryPromptRarity } from "@/lib/community-rarity";

describe("community rarity helpers", () => {
  it("maps community signal thresholds to common/rare/epic/legendary", () => {
    expect(
      getCommunityPostRarity({
        upvoteCount: 1,
        verifiedCount: 1,
        remixCount: 0,
        ratingAverage: 1,
      }),
    ).toBe("common");

    expect(
      getCommunityPostRarity({
        upvoteCount: 2,
        verifiedCount: 1,
        remixCount: 1,
        ratingAverage: 0,
      }),
    ).toBe("rare");

    expect(
      getCommunityPostRarity({
        upvoteCount: 4,
        verifiedCount: 2,
        remixCount: 2,
        ratingAverage: 0,
      }),
    ).toBe("epic");

    expect(
      getCommunityPostRarity({
        upvoteCount: 10,
        verifiedCount: 3,
        remixCount: 3,
        ratingAverage: 0,
      }),
    ).toBe("legendary");
  });

  it("applies featured override for community rarity class", () => {
    const post = {
      upvoteCount: 0,
      verifiedCount: 0,
      remixCount: 0,
      ratingAverage: 0,
    };

    expect(getCommunityPostRarityClass(post, false)).toBe("pf-rarity-common");
    expect(getCommunityPostRarityClass(post, true)).toBe("pf-rarity-legendary");
  });

  it("rounds rating averages when computing community signal", () => {
    expect(
      getCommunityPostRarity({
        upvoteCount: 4,
        verifiedCount: 0,
        remixCount: 0,
        ratingAverage: 1.6,
      }),
    ).toBe("rare");
  });

  it("maps library prompt thresholds and caps tag contribution", () => {
    expect(
      getLibraryPromptRarity({
        revision: 1,
        sourceCount: 1,
        databaseCount: 1,
        tags: [],
        isShared: false,
        remixedFrom: null,
      }),
    ).toBe("common");

    expect(
      getLibraryPromptRarity({
        revision: 1,
        sourceCount: 1,
        databaseCount: 1,
        tags: ["a"],
        isShared: false,
        remixedFrom: null,
      }),
    ).toBe("rare");

    expect(
      getLibraryPromptRarity({
        revision: 1,
        sourceCount: 1,
        databaseCount: 1,
        tags: ["a", "b", "c", "d", "e", "f"],
        isShared: true,
        remixedFrom: "seed-id",
      }),
    ).toBe("epic");

    expect(
      getLibraryPromptRarity({
        revision: 2,
        sourceCount: 2,
        databaseCount: 2,
        tags: ["a", "b", "c", "d"],
        isShared: true,
        remixedFrom: "seed-id",
      }),
    ).toBe("legendary");
  });
});
