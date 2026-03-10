import type {
  AmbiguityMode,
  EnhancementDepth,
  RewriteStrictness,
} from "@/lib/user-preferences";

export const ENHANCEMENT_DEPTH_OPTIONS: {
  value: EnhancementDepth;
  label: string;
}[] = [
  { value: "quick", label: "Light polish" },
  { value: "guided", label: "Structured rewrite" },
  { value: "advanced", label: "Expert prompt" },
];

export const AMBIGUITY_MODE_OPTIONS: {
  value: AmbiguityMode;
  label: string;
}[] = [
  { value: "ask_me", label: "Ask me" },
  { value: "placeholders", label: "Use placeholders" },
  { value: "infer_conservatively", label: "Infer conservatively" },
];

export const REWRITE_STRICTNESS_OPTIONS: {
  value: RewriteStrictness;
  label: string;
}[] = [
  { value: "preserve", label: "Preserve wording" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Optimize aggressively" },
];

export function getEnhancementDepthLabel(value: EnhancementDepth): string {
  return (
    ENHANCEMENT_DEPTH_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

export function getRewriteStrictnessLabel(
  value: RewriteStrictness,
): string {
  return (
    REWRITE_STRICTNESS_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

export function getAmbiguityModeLabel(value: AmbiguityMode): string {
  return (
    AMBIGUITY_MODE_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

export function getEnhancementSettingsSummary({
  enhancementDepth,
  rewriteStrictness,
  ambiguityMode,
}: {
  enhancementDepth: EnhancementDepth;
  rewriteStrictness: RewriteStrictness;
  ambiguityMode: AmbiguityMode;
}): string {
  return [
    getEnhancementDepthLabel(enhancementDepth),
    getRewriteStrictnessLabel(rewriteStrictness),
    getAmbiguityModeLabel(ambiguityMode),
  ].join(" · ");
}
