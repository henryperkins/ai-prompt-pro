function parseBooleanFlag(value: string | undefined, defaultValue = false): boolean {
  if (typeof value !== "string") return defaultValue;

  const trimmed = value.trim();
  if (!trimmed) return defaultValue;

  const normalized = trimmed.toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export interface BuilderRedesignFlags {
  builderRedesignPhase1: boolean;
  builderRedesignPhase2: boolean;
  builderRedesignPhase3: boolean;
  builderRedesignPhase4: boolean;
}

export const builderRedesignFlags: BuilderRedesignFlags = {
  builderRedesignPhase1: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE1, true),
  builderRedesignPhase2: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE2, true),
  builderRedesignPhase3: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE3, true),
  builderRedesignPhase4: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE4, true),
};

export interface CommunityFeatureFlags {
  communityMobileEnhancements: boolean;
  communityFeedUxV2: boolean;
}

export const communityFeatureFlags: CommunityFeatureFlags = {
  communityMobileEnhancements: parseBooleanFlag(import.meta.env.VITE_COMMUNITY_MOBILE_ENHANCEMENTS),
  communityFeedUxV2: parseBooleanFlag(import.meta.env.VITE_COMMUNITY_FEED_UX_V2, true),
};

export interface LaunchExperimentFlags {
  launchHeroCopyExperiment: boolean;
  launchPrimaryCtaExperiment: boolean;
}

export const launchExperimentFlags: LaunchExperimentFlags = {
  launchHeroCopyExperiment: parseBooleanFlag(import.meta.env.VITE_LAUNCH_EXPERIMENT_HERO_COPY),
  launchPrimaryCtaExperiment: parseBooleanFlag(import.meta.env.VITE_LAUNCH_EXPERIMENT_PRIMARY_CTA),
};
