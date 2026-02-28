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
      theme: "light",
      webSearchEnabled: false,
      showAdvancedControls: false,
      recentlyUsedPresetIds: [],
      favoritePresetIds: [],
    });
  });

  it("returns stored values", () => {
    localStorage.setItem(
      "promptforge-user-prefs",
      JSON.stringify({
        theme: "dark",
        webSearchEnabled: true,
        showAdvancedControls: true,
        recentlyUsedPresetIds: ["blog-post", "email-campaign"],
        favoritePresetIds: ["code-review"],
      }),
    );
    resetPreferencesCache();
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe("dark");
    expect(prefs.webSearchEnabled).toBe(true);
    expect(prefs.showAdvancedControls).toBe(true);
    expect(prefs.recentlyUsedPresetIds).toEqual(["blog-post", "email-campaign"]);
    expect(prefs.favoritePresetIds).toEqual(["code-review"]);
  });

  it("falls back to defaults for corrupt JSON", () => {
    localStorage.setItem("promptforge-user-prefs", "NOT_JSON");
    resetPreferencesCache();
    expect(getUserPreferences().theme).toBe("light");
  });

  it("fills missing keys with defaults", () => {
    localStorage.setItem("promptforge-user-prefs", JSON.stringify({ theme: "dark" }));
    resetPreferencesCache();
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe("dark");
    expect(prefs.webSearchEnabled).toBe(false);
    expect(prefs.showAdvancedControls).toBe(false);
    expect(prefs.recentlyUsedPresetIds).toEqual([]);
    expect(prefs.favoritePresetIds).toEqual([]);
  });

  it("normalizes invalid theme value to light", () => {
    localStorage.setItem("promptforge-user-prefs", JSON.stringify({ theme: "blue" }));
    resetPreferencesCache();
    expect(getUserPreferences().theme).toBe("light");
  });
});

describe("setUserPreference", () => {
  it("persists a single key and updates cache", () => {
    setUserPreference("theme", "dark");
    expect(getUserPreferences().theme).toBe("dark");

    const stored = JSON.parse(localStorage.getItem("promptforge-user-prefs")!);
    expect(stored.theme).toBe("dark");
  });

  it("preserves other keys when updating one", () => {
    setUserPreference("webSearchEnabled", true);
    setUserPreference("theme", "dark");
    expect(getUserPreferences().webSearchEnabled).toBe(true);
    expect(getUserPreferences().theme).toBe("dark");
  });

  it("persists preset personalization arrays", () => {
    setUserPreference("recentlyUsedPresetIds", ["blog-post", "email-campaign"]);
    setUserPreference("favoritePresetIds", ["code-review"]);
    expect(getUserPreferences().recentlyUsedPresetIds).toEqual(["blog-post", "email-campaign"]);
    expect(getUserPreferences().favoritePresetIds).toEqual(["code-review"]);
  });
});
