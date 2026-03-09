import { describe, it, expect, beforeEach } from "vitest";
import {
  getUserPreferences,
  setUserPreference,
  resetPreferencesCache,
} from "@/lib/user-preferences";

beforeEach(() => {
  localStorage.clear();
  resetPreferencesCache();
});

describe("getUserPreferences", () => {
  it("returns defaults when nothing is stored", () => {
    const prefs = getUserPreferences();
    expect(prefs).toEqual({
      theme: "default",
      webSearchEnabled: false,
      showAdvancedControls: false,
      recentlyUsedPresetIds: [],
      favoritePresetIds: [],
      enhancementDepth: "guided",
      rewriteStrictness: "balanced",
      ambiguityMode: "infer_conservatively",
    });
  });

  it("returns stored values", () => {
    localStorage.setItem(
      "promptforge-user-prefs",
      JSON.stringify({
        theme: "midnight",
        webSearchEnabled: true,
        showAdvancedControls: true,
        recentlyUsedPresetIds: ["blog-post", "email-campaign"],
        favoritePresetIds: ["code-review"],
      }),
    );
    resetPreferencesCache();
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe("midnight");
    expect(prefs.webSearchEnabled).toBe(true);
    expect(prefs.showAdvancedControls).toBe(true);
    expect(prefs.recentlyUsedPresetIds).toEqual(["blog-post", "email-campaign"]);
    expect(prefs.favoritePresetIds).toEqual(["code-review"]);
  });

  it("falls back to defaults for corrupt JSON", () => {
    localStorage.setItem("promptforge-user-prefs", "NOT_JSON");
    resetPreferencesCache();
    expect(getUserPreferences().theme).toBe("default");
  });

  it("fills missing keys with defaults", () => {
    localStorage.setItem("promptforge-user-prefs", JSON.stringify({ theme: "midnight" }));
    resetPreferencesCache();
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe("midnight");
    expect(prefs.webSearchEnabled).toBe(false);
    expect(prefs.showAdvancedControls).toBe(false);
    expect(prefs.recentlyUsedPresetIds).toEqual([]);
    expect(prefs.favoritePresetIds).toEqual([]);
    expect(prefs.enhancementDepth).toBe("guided");
    expect(prefs.rewriteStrictness).toBe("balanced");
    expect(prefs.ambiguityMode).toBe("infer_conservatively");
  });

  it("maps the legacy light/dark values onto the current theme model", () => {
    localStorage.setItem("promptforge-user-prefs", JSON.stringify({ theme: "light" }));
    expect(getUserPreferences().theme).toBe("default");

    resetPreferencesCache();
    localStorage.setItem("promptforge-user-prefs", JSON.stringify({ theme: "dark" }));
    expect(getUserPreferences().theme).toBe("midnight");
  });

  it("normalizes invalid theme value to default", () => {
    localStorage.setItem("promptforge-user-prefs", JSON.stringify({ theme: "blue" }));
    resetPreferencesCache();
    expect(getUserPreferences().theme).toBe("default");
  });
});

describe("setUserPreference", () => {
  it("persists a single key and updates cache", () => {
    setUserPreference("theme", "midnight");
    expect(getUserPreferences().theme).toBe("midnight");

    const stored = JSON.parse(localStorage.getItem("promptforge-user-prefs")!);
    expect(stored.theme).toBe("midnight");
  });

  it("preserves other keys when updating one", () => {
    setUserPreference("webSearchEnabled", true);
    setUserPreference("theme", "midnight");
    expect(getUserPreferences().webSearchEnabled).toBe(true);
    expect(getUserPreferences().theme).toBe("midnight");
  });

  it("persists preset personalization arrays", () => {
    setUserPreference("recentlyUsedPresetIds", ["blog-post", "email-campaign"]);
    setUserPreference("favoritePresetIds", ["code-review"]);
    expect(getUserPreferences().recentlyUsedPresetIds).toEqual(["blog-post", "email-campaign"]);
    expect(getUserPreferences().favoritePresetIds).toEqual(["code-review"]);
  });
});
