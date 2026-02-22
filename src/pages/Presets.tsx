import { useMemo, useState } from "react";
import { createSearchParams, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
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
  const fields = [
    template.role && `Role: ${template.role}`,
    template.tone && `Tone: ${template.tone}`,
    template.complexity && `Complexity: ${template.complexity}`,
    template.format.length > 0 && `Format: ${template.format.join(", ")}`,
  ].filter(Boolean) as string[];

  return (
    <Card className={cn("interactive-card pf-card group overflow-hidden border", skin.card)}>
      <div className="p-3 sm:p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full text-sm", skin.iconWrap)}>
              {categoryIcons[template.category] ?? categoryIcons.general}
            </span>
            <h3 className="font-semibold text-sm text-foreground">{template.name}</h3>
            <Badge type="modern" className={cn("border border-border bg-background text-foreground text-xs capitalize", skin.badge)}>
              {categoryLabels[template.category]}
            </Badge>
          </div>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>

        <p className="text-xs text-muted-foreground/90 line-clamp-2">
          <span className="font-medium text-foreground/80">Starter:</span> {template.starterPrompt}
        </p>

        <div className="flex flex-wrap gap-1">
          {fields.map((f) => (
            <Badge key={f} type="modern" className="text-xs">{f}</Badge>
          ))}
        </div>

        <div className="pt-1">
          <Button
            type="button"
            color="secondary"
            size="sm"
            className={cn("h-11 gap-1.5 text-sm sm:h-9 sm:text-base", skin.action)}
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

  const categories = useMemo(() => {
    const used = new Set(templates.map((t) => t.category));
    return ["all", ...Array.from(used)] as string[];
  }, []);

  const filtered = useMemo(() => {
    let result = templates;
    if (activeCategory !== "all") {
      result = result.filter((t) => t.category === activeCategory);
    }
    if (query.trim()) {
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
  }, [activeCategory, query]);

  return (
    <PageShell>
      <PageHero
        title="Presets"
        subtitle="Starter templates that auto-populate the builder. Pick one and start enhancing."
        className="pf-gilded-frame pf-hero-surface"
      />

      <div className="mx-auto max-w-4xl space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search presets..."
            aria-label="Search presets"
            className="h-11 pl-9 sm:h-10"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter presets by category">
          {categories.map((cat) => (
            <Button
              key={cat}
              color={activeCategory === cat ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className="interactive-chip h-11 gap-1.5 text-sm capitalize sm:h-9 sm:text-base"
            >
              {cat !== "all" && (
                <span className="text-sm">{categoryIcons[cat as PromptCategory] ?? ""}</span>
              )}
              {cat === "all" ? "All" : categoryLabels[cat as PromptCategory] ?? cat}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Card className="pf-card border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No presets match.</p>
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
