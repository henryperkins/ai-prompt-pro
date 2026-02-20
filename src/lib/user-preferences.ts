const STORAGE_KEY = "promptforge-user-prefs";

export interface UserPreferences {
  theme: "light" | "dark";
  webSearchEnabled: boolean;
  showAdvancedControls: boolean;
}

const defaults: UserPreferences = {
  theme: "light",
  webSearchEnabled: false,
  showAdvancedControls: false,
};

function load(): UserPreferences {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      webSearchEnabled: typeof parsed.webSearchEnabled === "boolean" ? parsed.webSearchEnabled : defaults.webSearchEnabled,
      showAdvancedControls: typeof parsed.showAdvancedControls === "boolean" ? parsed.showAdvancedControls : defaults.showAdvancedControls,
    };
  } catch {
    return { ...defaults };
  }
}

let cached: UserPreferences | null = null;

export function getUserPreferences(): UserPreferences {
  if (!cached) cached = load();
  return cached;
}

export function setUserPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): void {
  const prefs = getUserPreferences();
  prefs[key] = value;
  cached = prefs;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — preference still cached in memory for session.
  }
}

/** Reset the in-memory cache (useful for tests). */
export function resetPreferencesCache(): void {
  cached = null;
}
