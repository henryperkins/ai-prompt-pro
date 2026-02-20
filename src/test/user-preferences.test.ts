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
    });
  });

  it("returns stored values", () => {
    localStorage.setItem(
      "promptforge-user-prefs",
      JSON.stringify({ theme: "dark", webSearchEnabled: true, showAdvancedControls: true }),
    );
    resetPreferencesCache();
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe("dark");
    expect(prefs.webSearchEnabled).toBe(true);
    expect(prefs.showAdvancedControls).toBe(true);
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
});
