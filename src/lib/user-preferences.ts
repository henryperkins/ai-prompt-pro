const STORAGE_KEY = "promptforge-user-prefs";
const MAX_PRESET_ID_PREFERENCES = 24;

export type ThemePreference = "default" | "midnight";
export type EnhancementDepth = "quick" | "guided" | "advanced";
export type RewriteStrictness = "preserve" | "balanced" | "aggressive";
export type AmbiguityMode = "ask_me" | "placeholders" | "infer_conservatively";

export interface UserPreferences {
  theme: ThemePreference;
  webSearchEnabled: boolean;
  showAdvancedControls: boolean;
  recentlyUsedPresetIds: string[];
  favoritePresetIds: string[];
  enhancementDepth: EnhancementDepth;
  rewriteStrictness: RewriteStrictness;
  ambiguityMode: AmbiguityMode;
}

const ENHANCEMENT_DEPTHS: Set<string> = new Set(["quick", "guided", "advanced"]);
const REWRITE_STRICTNESS_VALUES: Set<string> = new Set(["preserve", "balanced", "aggressive"]);
const AMBIGUITY_MODE_VALUES: Set<string> = new Set(["ask_me", "placeholders", "infer_conservatively"]);

const defaults: UserPreferences = {
  theme: "default",
  webSearchEnabled: false,
  showAdvancedControls: false,
  recentlyUsedPresetIds: [],
  favoritePresetIds: [],
  enhancementDepth: "guided",
  rewriteStrictness: "balanced",
  ambiguityMode: "infer_conservatively",
};

function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "midnight" || value === "dark") return "midnight";
  return "default";
}

function normalizePresetIdPreference(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(ids)).slice(0, MAX_PRESET_ID_PREFERENCES);
}

function normalizeEnhancementDepth(value: unknown): EnhancementDepth {
  if (typeof value === "string" && ENHANCEMENT_DEPTHS.has(value)) return value as EnhancementDepth;
  return defaults.enhancementDepth;
}

function normalizeRewriteStrictness(value: unknown): RewriteStrictness {
  if (typeof value === "string" && REWRITE_STRICTNESS_VALUES.has(value)) return value as RewriteStrictness;
  return defaults.rewriteStrictness;
}

function normalizeAmbiguityMode(value: unknown): AmbiguityMode {
  if (typeof value === "string" && AMBIGUITY_MODE_VALUES.has(value)) return value as AmbiguityMode;
  return defaults.ambiguityMode;
}

function load(): UserPreferences {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      theme: normalizeThemePreference(parsed.theme),
      webSearchEnabled: typeof parsed.webSearchEnabled === "boolean" ? parsed.webSearchEnabled : defaults.webSearchEnabled,
      showAdvancedControls: typeof parsed.showAdvancedControls === "boolean" ? parsed.showAdvancedControls : defaults.showAdvancedControls,
      recentlyUsedPresetIds: normalizePresetIdPreference(parsed.recentlyUsedPresetIds),
      favoritePresetIds: normalizePresetIdPreference(parsed.favoritePresetIds),
      enhancementDepth: normalizeEnhancementDepth(parsed.enhancementDepth),
      rewriteStrictness: normalizeRewriteStrictness(parsed.rewriteStrictness),
      ambiguityMode: normalizeAmbiguityMode(parsed.ambiguityMode),
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
