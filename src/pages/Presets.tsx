import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSearchParams, useNavigate } from "react-router-dom";
import { PageHero, PageShell } from "@/components/PageShell";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
import { Input } from "@/components/base/input/input";
import {
  templates,
  categoryLabels,
  promptCategorySkins,
  type PromptTemplate,
  type PromptCategory,
} from "@/lib/templates";
import {
  filterPresetTemplates,
  getPresetCategories,
  hasActivePresetFilters,
  rankPresetTemplates,
  splitPresetSections,
} from "@/lib/preset-catalog";
import { trackBuilderEvent } from "@/lib/telemetry";
import { getUserPreferences, setUserPreference } from "@/lib/user-preferences";
import { cn } from "@/lib/utils";
import { MagnifyingGlass as Search } from "@phosphor-icons/react";

const categoryIcons: Record<string, string> = {
  general: "✦",
  frontend: "🖥",
  backend: "⚙",
  fullstack: "◇",
  devops: "☁",
  data: "📊",
  "ml-ai": "🧠",
  security: "🛡",
  testing: "🧪",
  api: "🔌",
  automation: "🤖",
  docs: "📝",
};

function PresetCard({
  template,
  isFavorite,
  onToggleFavorite,
}: {
  template: PromptTemplate;
  isFavorite: boolean;
  onToggleFavorite: (templateId: string) => void;
}) {
  const navigate = useNavigate();
  const skin = promptCategorySkins[template.category] ?? promptCategorySkins.general;
  const presetSearch = createSearchParams({ preset: template.id }).toString();
  const categoryLabel = categoryLabels[template.category] ?? template.category;
  const fields = [
    template.role && `Role: ${template.role}`,
    template.tone && `Tone: ${template.tone}`,
    template.complexity && `Complexity: ${template.complexity}`,
    template.format.length > 0 && `Format: ${template.format.join(", ")}`,
  ].filter(Boolean) as string[];

  return (
    <Card className={cn("interactive-card pf-card group h-full overflow-hidden border", skin.card)}>
      <div className="flex h-full flex-col space-y-2 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full text-sm", skin.iconWrap)}>
              {categoryIcons[template.category] ?? categoryIcons.general}
            </span>
            <h3 className="text-sm font-semibold text-primary_on-brand">{template.name}</h3>
            <Badge
              type="pill-color"
              size="sm"
              className={cn(
                "border border-border/60 bg-background/70 text-secondary_on-brand ring-transparent capitalize",
                skin.badge,
              )}
            >
              {categoryLabel}
            </Badge>
          </div>
          <Button
            type="button"
            color="tertiary"
            size="sm"
            className="h-8 w-8 p-0 text-base"
            aria-label={isFavorite ? `Remove ${template.name} from favorites` : `Add ${template.name} to favorites`}
            onClick={() => onToggleFavorite(template.id)}
          >
            {isFavorite ? "★" : "☆"}
          </Button>
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-secondary_on-brand">{template.description}</p>

        <p className="line-clamp-2 text-xs leading-relaxed text-tertiary_on-brand">
          <span className="font-medium text-secondary_on-brand">Starter:</span> {template.starterPrompt}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {fields.map((f) => (
            <Badge
              key={f}
              type="pill-color"
              size="sm"
              className="border border-border/60 bg-background/65 text-secondary_on-brand ring-transparent"
            >
              {f}
            </Badge>
          ))}
        </div>

        <div className="mt-auto pt-2">
          <Button
            type="button"
            color="primary"
            size="sm"
            aria-label={`Use ${template.name} preset`}
            className="h-10 w-full gap-1.5 text-sm font-semibold sm:h-9 sm:w-auto"
            onClick={() => {
              trackBuilderEvent("preset_clicked", {
                presetId: template.id,
                presetCategory: template.category,
              });
              navigate({ pathname: "/", search: `?${presetSearch}` });
            }}
          >
            Use preset
          </Button>
        </div>
      </div>
    </Card>
  );
}

const Presets = () => {
  const initialPreferences = useMemo(() => getUserPreferences(), []);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [favoritePresetIds, setFavoritePresetIds] = useState<string[]>(() => initialPreferences.favoritePresetIds);
  const [recentlyUsedPresetIds] = useState<string[]>(() => initialPreferences.recentlyUsedPresetIds);
  const hasTrackedPresetViewed = useRef(false);

  const hasQuery = query.trim().length > 0;

  const clearFilters = () => {
    setQuery("");
    setActiveCategory("all");
  };

  const handleQueryChange = (nextValue: string | ChangeEvent<HTMLInputElement>) => {
    if (typeof nextValue === "string") {
      setQuery(nextValue);
      return;
    }

    setQuery(nextValue.target.value);
  };

  const categories = useMemo(() => {
    return getPresetCategories(templates);
  }, []);

  const favoritePresetIdSet = useMemo(() => new Set(favoritePresetIds), [favoritePresetIds]);

  useEffect(() => {
    if (hasTrackedPresetViewed.current) return;
    hasTrackedPresetViewed.current = true;
    trackBuilderEvent("preset_viewed", {
      totalPresets: templates.length,
      categoryCount: categories.length - 1,
      recentCount: recentlyUsedPresetIds.length,
      favoriteCount: favoritePresetIds.length,
    });
  }, [categories.length, recentlyUsedPresetIds.length, favoritePresetIds.length]);

  const toggleFavoritePreset = useCallback((templateId: string) => {
    setFavoritePresetIds((prev) => {
      const next = prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [templateId, ...prev.filter((id) => id !== templateId)];
      setUserPreference("favoritePresetIds", next);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    return filterPresetTemplates({
      items: templates,
      activeCategory,
      query,
    });
  }, [activeCategory, query]);

  const rankedFiltered = useMemo(() => {
    return rankPresetTemplates({
      items: filtered,
      favoritePresetIds,
      recentlyUsedPresetIds,
    });
  }, [favoritePresetIds, filtered, recentlyUsedPresetIds]);

  const hasActiveFilters = hasActivePresetFilters(activeCategory, query);
  const presetSections = useMemo(() => {
    return splitPresetSections({
      items: rankedFiltered,
      favoritePresetIds,
      recentlyUsedPresetIds,
      hasActiveFilters,
    });
  }, [favoritePresetIds, hasActiveFilters, rankedFiltered, recentlyUsedPresetIds]);

  const recentSectionTemplates = presetSections.recent;
  const favoriteSectionTemplates = presetSections.favorites;
  const allSectionTemplates = presetSections.all;
  const activeCategoryLabel =
    activeCategory === "all"
      ? "All categories"
      : (categoryLabels[activeCategory as PromptCategory] ?? activeCategory);

  return (
    <PageShell>
      <PageHero
        title="Presets"
        subtitle="Starter templates that auto-populate the builder. Pick one and start enhancing."
        className="pf-gilded-frame pf-hero-surface"
      />

      <div className="mx-auto max-w-4xl space-y-4">
        <Input
          value={query}
          onChange={handleQueryChange}
          placeholder="Search presets..."
          aria-label="Search presets"
          icon={Search}
          className="h-11 sm:h-10"
        />

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter presets by category">
          {categories.map((cat) => (
            <Button
              key={cat}
              color={activeCategory === cat ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className="interactive-chip h-11 gap-1.5 rounded-full px-3 text-sm capitalize sm:h-9 sm:text-sm"
            >
              {cat !== "all" && (
                <span className="text-sm">{categoryIcons[cat as PromptCategory] ?? ""}</span>
              )}
              {cat === "all" ? "All" : categoryLabels[cat as PromptCategory] ?? cat}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground" aria-live="polite" data-testid="preset-results-summary">
            Showing <span className="font-semibold text-foreground">{rankedFiltered.length}</span> of {templates.length} presets
            {activeCategory !== "all" ? ` in ${activeCategoryLabel}` : ""}
            {hasQuery ? ` matching “${query.trim()}”` : ""}
          </p>
          {hasActiveFilters && (
            <Button
              type="button"
              color="tertiary"
              size="sm"
              className="h-9 text-sm"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>

        {rankedFiltered.length === 0 ? (
          <Card className="pf-card border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No presets match your current filters.</p>
            {hasActiveFilters && (
              <div className="mt-3">
                <Button
                  type="button"
                  color="secondary"
                  size="sm"
                  className="h-9"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </Card>
        ) : hasActiveFilters ? (
          <section aria-label="All presets">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {allSectionTemplates.map((template) => (
                <PresetCard
                  key={template.id}
                  template={template}
                  isFavorite={favoritePresetIdSet.has(template.id)}
                  onToggleFavorite={toggleFavoritePreset}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="space-y-5">
            {recentSectionTemplates.length > 0 && (
              <section aria-label="Recent presets" className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">Recent</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {recentSectionTemplates.map((template) => (
                    <PresetCard
                      key={template.id}
                      template={template}
                      isFavorite={favoritePresetIdSet.has(template.id)}
                      onToggleFavorite={toggleFavoritePreset}
                    />
                  ))}
                </div>
              </section>
            )}

            {favoriteSectionTemplates.length > 0 && (
              <section aria-label="Favorite presets" className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">Favorites</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {favoriteSectionTemplates.map((template) => (
                    <PresetCard
                      key={template.id}
                      template={template}
                      isFavorite={favoritePresetIdSet.has(template.id)}
                      onToggleFavorite={toggleFavoritePreset}
                    />
                  ))}
                </div>
              </section>
            )}

            <section aria-label="All presets" className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">All presets</h2>
              {allSectionTemplates.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {allSectionTemplates.map((template) => (
                    <PresetCard
                      key={template.id}
                      template={template}
                      isFavorite={favoritePresetIdSet.has(template.id)}
                      onToggleFavorite={toggleFavoritePreset}
                    />
                  ))}
                </div>
              ) : (
                <Card className="pf-card border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    All presets are already represented in your recent or favorite sections.
                  </p>
                </Card>
              )}
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default Presets;
