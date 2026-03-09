const PROFILE_STORAGE_KEY = "promptforge-enhancement-profile";

export interface EnhancementProfile {
  depthCounts: Record<string, number>;
  strictnessCounts: Record<string, number>;
  ambiguityModeCounts: Record<string, number>;
  variantCounts: Record<string, number>;
  acceptCount: number;
  rerunCount: number;
  totalEnhancements: number;
}

function createEmptyProfile(): EnhancementProfile {
  return {
    depthCounts: {},
    strictnessCounts: {},
    ambiguityModeCounts: {},
    variantCounts: {},
    acceptCount: 0,
    rerunCount: 0,
    totalEnhancements: 0,
  };
}

export function loadEnhancementProfile(): EnhancementProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return createEmptyProfile();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return createEmptyProfile();
    return {
      depthCounts: safeRecord(parsed.depthCounts),
      strictnessCounts: safeRecord(parsed.strictnessCounts),
      ambiguityModeCounts: safeRecord(parsed.ambiguityModeCounts),
      variantCounts: safeRecord(parsed.variantCounts),
      acceptCount: safeCounter(parsed.acceptCount),
      rerunCount: safeCounter(parsed.rerunCount),
      totalEnhancements: safeCounter(parsed.totalEnhancements),
    };
  } catch {
    return createEmptyProfile();
  }
}

export function recordEnhancementAction(
  action:
    | { type: "enhancement_completed"; depth: string; strictness: string; ambiguityMode: string }
    | { type: "variant_applied"; variant: string }
    | { type: "accepted" }
    | { type: "rerun" },
): void {
  const profile = loadEnhancementProfile();

  switch (action.type) {
    case "enhancement_completed":
      profile.totalEnhancements += 1;
      profile.depthCounts[action.depth] = (profile.depthCounts[action.depth] ?? 0) + 1;
      profile.strictnessCounts[action.strictness] = (profile.strictnessCounts[action.strictness] ?? 0) + 1;
      profile.ambiguityModeCounts[action.ambiguityMode] = (profile.ambiguityModeCounts[action.ambiguityMode] ?? 0) + 1;
      break;
    case "variant_applied":
      profile.variantCounts[action.variant] = (profile.variantCounts[action.variant] ?? 0) + 1;
      break;
    case "accepted":
      profile.acceptCount += 1;
      break;
    case "rerun":
      profile.rerunCount += 1;
      break;
  }

  saveProfile(profile);
}

export function getMostUsedPreference(counts: Record<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export function resetEnhancementProfile(): void {
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function saveProfile(profile: EnhancementProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

function safeCounter(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function safeRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      result[k] = Math.floor(v);
    }
  }
  return result;
}
