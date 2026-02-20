function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export interface BuilderRedesignFlags {
  builderRedesignPhase1: boolean;
  builderRedesignPhase2: boolean;
  builderRedesignPhase3: boolean;
  builderRedesignPhase4: boolean;
}

export const builderRedesignFlags: BuilderRedesignFlags = {
  builderRedesignPhase1: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE1),
  builderRedesignPhase2: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE2),
  builderRedesignPhase3: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE3),
  builderRedesignPhase4: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE4),
};

export interface CommunityFeatureFlags {
  communityMobileEnhancements: boolean;
}

export const communityFeatureFlags: CommunityFeatureFlags = {
  communityMobileEnhancements: parseBooleanFlag(import.meta.env.VITE_COMMUNITY_MOBILE_ENHANCEMENTS),
};

export interface LaunchExperimentFlags {
  launchHeroCopyExperiment: boolean;
  launchPrimaryCtaExperiment: boolean;
}

export const launchExperimentFlags: LaunchExperimentFlags = {
  launchHeroCopyExperiment: parseBooleanFlag(import.meta.env.VITE_LAUNCH_EXPERIMENT_HERO_COPY),
  launchPrimaryCtaExperiment: parseBooleanFlag(import.meta.env.VITE_LAUNCH_EXPERIMENT_PRIMARY_CTA),
};
