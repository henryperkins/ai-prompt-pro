import { type ChangeEvent, useMemo, useState } from "react";
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

function PresetCard({ template }: { template: PromptTemplate }) {
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
            onClick={() => navigate({ pathname: "/", search: `?${presetSearch}` })}
          >
            Use preset
          </Button>
        </div>
      </div>
    </Card>
  );
}

const Presets = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

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
    const used = new Set(templates.map((t) => t.category));
    return ["all", ...Array.from(used)] as string[];
  }, []);

  const filtered = useMemo(() => {
    let result = templates;
    if (activeCategory !== "all") {
      result = result.filter((t) => t.category === activeCategory);
    }
    if (hasQuery) {
      const q = query.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.starterPrompt.toLowerCase().includes(q),
      );
    }
    return result;
  }, [activeCategory, hasQuery, query]);

  const hasActiveFilters = hasQuery || activeCategory !== "all";
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
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {templates.length} presets
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

        {filtered.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((template) => (
              <PresetCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default Presets;
