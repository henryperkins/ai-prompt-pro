const STORAGE_KEY = "promptforge-user-prefs";
const MAX_PRESET_ID_PREFERENCES = 24;

export interface UserPreferences {
  theme: "light" | "dark";
  webSearchEnabled: boolean;
  showAdvancedControls: boolean;
  recentlyUsedPresetIds: string[];
  favoritePresetIds: string[];
}

const defaults: UserPreferences = {
  theme: "light",
  webSearchEnabled: false,
  showAdvancedControls: false,
  recentlyUsedPresetIds: [],
  favoritePresetIds: [],
};

function normalizePresetIdPreference(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(ids)).slice(0, MAX_PRESET_ID_PREFERENCES);
}

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
      recentlyUsedPresetIds: normalizePresetIdPreference(parsed.recentlyUsedPresetIds),
      favoritePresetIds: normalizePresetIdPreference(parsed.favoritePresetIds),
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
