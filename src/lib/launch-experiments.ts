import { brandCopy } from "@/lib/brand-copy";

export type HeroCopyVariant = "control" | "speed";

export interface LaunchExperimentAssignments {
  heroCopy: HeroCopyVariant;
}

const HERO_VARIANTS: readonly HeroCopyVariant[] = ["control", "speed"];
const STORAGE_KEY_HERO_COPY = "promptforge:launch-exp:hero-copy";
const QUERY_KEY_HERO_COPY = "exp_hero";

const heroCopyQueryMap: Record<string, HeroCopyVariant> = {
  a: "control",
  b: "speed",
  control: "control",
  speed: "speed",
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

  const heroCopy = heroFromQuery || pickStoredVariant(STORAGE_KEY_HERO_COPY, HERO_VARIANTS, random);

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY_HERO_COPY, heroCopy);
  }

  return {
    heroCopy,
  };
}

export function getHeroCopyVariant(variant: HeroCopyVariant): { headline: string; subhead: string } {
  if (variant === "speed") {
    return {
      headline: "Ship quality prompts faster with grounded context",
      subhead:
        "Start from rough intent, enhance the prompt, and remix proven prompts without rewriting from scratch.",
    };
  }

  return {
    headline: brandCopy.hero.headline,
    subhead: brandCopy.hero.subhead,
  };
}
