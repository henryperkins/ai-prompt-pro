import { brandCopy } from "@/lib/brand-copy";

export type HeroCopyVariant = "control" | "speed";
export type PrimaryCtaVariant = "control" | "quality_pass";

export interface LaunchExperimentAssignments {
  heroCopy: HeroCopyVariant;
  primaryCta: PrimaryCtaVariant;
}

const HERO_VARIANTS: readonly HeroCopyVariant[] = ["control", "speed"];
const PRIMARY_CTA_VARIANTS: readonly PrimaryCtaVariant[] = ["control", "quality_pass"];
const STORAGE_KEY_HERO_COPY = "promptforge:launch-exp:hero-copy";
const STORAGE_KEY_PRIMARY_CTA = "promptforge:launch-exp:primary-cta";
const QUERY_KEY_HERO_COPY = "exp_hero";
const QUERY_KEY_PRIMARY_CTA = "exp_cta";

const heroCopyQueryMap: Record<string, HeroCopyVariant> = {
  a: "control",
  b: "speed",
  control: "control",
  speed: "speed",
};

const primaryCtaQueryMap: Record<string, PrimaryCtaVariant> = {
  a: "control",
  b: "quality_pass",
  control: "control",
  quality_pass: "quality_pass",
};

function normalizeExperimentToken(value: string | null): string {
  return (value || "").trim().toLowerCase();
}

function pickStoredVariant<T extends string>(
  storageKey: string,
  variants: readonly T[],
  random: () => number,
): T {
  if (typeof window === "undefined") return variants[0];

  const stored = window.sessionStorage.getItem(storageKey);
  if (stored && variants.includes(stored as T)) return stored as T;

  const next = random() < 0.5 ? variants[0] : variants[1];
  window.sessionStorage.setItem(storageKey, next);
  return next;
}

function readQueryValue(search: string | undefined, key: string): string | null {
  if (typeof search === "string") {
    return new URLSearchParams(search).get(key);
  }
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export function getLaunchExperimentAssignments(options: {
  search?: string;
  random?: () => number;
} = {}): LaunchExperimentAssignments {
  const random = options.random ?? Math.random;

  const heroQuery = normalizeExperimentToken(readQueryValue(options.search, QUERY_KEY_HERO_COPY));
  const heroFromQuery = heroCopyQueryMap[heroQuery];

  const primaryCtaQuery = normalizeExperimentToken(readQueryValue(options.search, QUERY_KEY_PRIMARY_CTA));
  const primaryCtaFromQuery = primaryCtaQueryMap[primaryCtaQuery];

  const heroCopy = heroFromQuery || pickStoredVariant(STORAGE_KEY_HERO_COPY, HERO_VARIANTS, random);
  const primaryCta =
    primaryCtaFromQuery || pickStoredVariant(STORAGE_KEY_PRIMARY_CTA, PRIMARY_CTA_VARIANTS, random);

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY_HERO_COPY, heroCopy);
    window.sessionStorage.setItem(STORAGE_KEY_PRIMARY_CTA, primaryCta);
  }

  return {
    heroCopy,
    primaryCta,
  };
}

export function getHeroCopyVariant(variant: HeroCopyVariant): { headline: string; subhead: string } {
  if (variant === "speed") {
    return {
      headline: "Ship quality prompts faster with grounded context",
      subhead:
        "Start from rough intent, run a quality pass, and remix proven prompts without rewriting from scratch.",
    };
  }

  return {
    headline: brandCopy.hero.headline,
    subhead: brandCopy.hero.subhead,
  };
}

export function getPrimaryCtaVariantLabel(variant: PrimaryCtaVariant): string {
  if (variant === "quality_pass") return "Run quality pass";
  return brandCopy.hero.primaryCta;
}
