/**
 * Shared density variants used by UI primitives that need consistent sizing
 * across screens (state cards, toolbar actions, and section labels).
 */
export const UI_DENSITY_VARIANTS = ["comfortable", "compact"] as const;

export type UIDensity = (typeof UI_DENSITY_VARIANTS)[number];

export const DEFAULT_UI_DENSITY: UIDensity = "comfortable";
