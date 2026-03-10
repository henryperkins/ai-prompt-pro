const PROFILE_STORAGE_KEY = "promptforge-enhancement-profile";

export interface EnhancementProfile {
  depthCounts: Record<string, number>;
  strictnessCounts: Record<string, number>;
  ambiguityModeCounts: Record<string, number>;
  variantCounts: Record<string, number>;
  intentOverrideCounts: Record<string, number>;
  assumptionEditCounts: Record<string, number>;
  formatCounts: Record<string, number>;
  structuredApplyCounts: Record<string, number>;
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
    intentOverrideCounts: {},
    assumptionEditCounts: {},
    formatCounts: {},
    structuredApplyCounts: {},
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
      intentOverrideCounts: safeRecord(parsed.intentOverrideCounts),
      assumptionEditCounts: safeRecord(parsed.assumptionEditCounts),
      formatCounts: safeRecord(parsed.formatCounts),
      structuredApplyCounts: safeRecord(parsed.structuredApplyCounts),
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
    | { type: "rerun" }
    | { type: "intent_overridden"; intent: string }
    | { type: "assumption_edited"; key: string }
    | { type: "format_accepted"; format: string }
    | { type: "structured_apply_all"; key?: string },
): void {
  const profile = loadEnhancementProfile();

  switch (action.type) {
    case "enhancement_completed":
      profile.totalEnhancements += 1;
      incrementRecord(profile.depthCounts, action.depth);
      incrementRecord(profile.strictnessCounts, action.strictness);
      incrementRecord(profile.ambiguityModeCounts, action.ambiguityMode);
      break;
    case "variant_applied":
      incrementRecord(profile.variantCounts, action.variant);
      break;
    case "accepted":
      profile.acceptCount += 1;
      break;
    case "rerun":
      profile.rerunCount += 1;
      break;
    case "intent_overridden":
      incrementRecord(profile.intentOverrideCounts, action.intent);
      break;
    case "assumption_edited":
      incrementRecord(profile.assumptionEditCounts, action.key);
      break;
    case "format_accepted":
      incrementRecord(profile.formatCounts, action.format);
      break;
    case "structured_apply_all":
      incrementRecord(profile.structuredApplyCounts, action.key ?? "all");
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

function incrementRecord(record: Record<string, number>, key: string): void {
  const normalizedKey = key.trim();
  if (!normalizedKey) return;
  record[normalizedKey] = (record[normalizedKey] ?? 0) + 1;
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
