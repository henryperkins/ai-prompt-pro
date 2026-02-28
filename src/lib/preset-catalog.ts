import type { PromptTemplate } from "@/lib/templates";

const ALL_CATEGORY_ID = "all";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function getPresetCategories(items: PromptTemplate[]): string[] {
  const used = new Set(items.map((template) => template.category));
  return [ALL_CATEGORY_ID, ...Array.from(used)];
}

export function hasActivePresetFilters(activeCategory: string, query: string): boolean {
  return activeCategory !== ALL_CATEGORY_ID || query.trim().length > 0;
}

export function filterPresetTemplates(input: {
  items: PromptTemplate[];
  activeCategory: string;
  query: string;
}): PromptTemplate[] {
  const { items, activeCategory, query } = input;
  const scoped = activeCategory === ALL_CATEGORY_ID
    ? items
    : items.filter((template) => template.category === activeCategory);

  const normalized = normalizeQuery(query);
  if (!normalized) return scoped;

  return scoped.filter((template) => {
    const haystack = [
      template.name,
      template.description,
      template.starterPrompt,
      template.category,
      template.tone,
      template.complexity,
    ].join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
}

export function rankPresetTemplates(input: {
  items: PromptTemplate[];
  favoritePresetIds?: string[];
  recentlyUsedPresetIds?: string[];
}): PromptTemplate[] {
  const {
    items,
    favoritePresetIds = [],
    recentlyUsedPresetIds = [],
  } = input;

  const favoriteSet = new Set(favoritePresetIds);
  const recentRank = new Map<string, number>();
  recentlyUsedPresetIds.forEach((id, index) => {
    recentRank.set(id, index);
  });

  return [...items].sort((left, right) => {
    const leftFavorite = favoriteSet.has(left.id);
    const rightFavorite = favoriteSet.has(right.id);
    if (leftFavorite !== rightFavorite) {
      return rightFavorite ? 1 : -1;
    }

    const leftRecentRank = recentRank.get(left.id);
    const rightRecentRank = recentRank.get(right.id);
    const leftHasRecentRank = typeof leftRecentRank === "number";
    const rightHasRecentRank = typeof rightRecentRank === "number";
    if (leftHasRecentRank && rightHasRecentRank) {
      return leftRecentRank - rightRecentRank;
    }
    if (leftHasRecentRank !== rightHasRecentRank) {
      return leftHasRecentRank ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function splitPresetSections(input: {
  items: PromptTemplate[];
  favoritePresetIds?: string[];
  recentlyUsedPresetIds?: string[];
  hasActiveFilters: boolean;
}): {
  recent: PromptTemplate[];
  favorites: PromptTemplate[];
  all: PromptTemplate[];
} {
  const {
    items,
    favoritePresetIds = [],
    recentlyUsedPresetIds = [],
    hasActiveFilters,
  } = input;

  if (hasActiveFilters) {
    return {
      recent: [],
      favorites: [],
      all: items,
    };
  }

  const byId = new Map(items.map((template) => [template.id, template]));
  const recent = recentlyUsedPresetIds
    .map((id) => byId.get(id))
    .filter((template): template is PromptTemplate => Boolean(template));
  const recentIdSet = new Set(recent.map((template) => template.id));
  const favoriteSet = new Set(favoritePresetIds);
  const favorites = items.filter(
    (template) => favoriteSet.has(template.id) && !recentIdSet.has(template.id),
  );
  const highlightedIdSet = new Set([
    ...recent.map((template) => template.id),
    ...favorites.map((template) => template.id),
  ]);
  const all = items.filter((template) => !highlightedIdSet.has(template.id));

  return {
    recent,
    favorites,
    all,
  };
}

