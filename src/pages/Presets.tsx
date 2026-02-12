import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { PageHero, PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  templates,
  categoryLabels,
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

const categoryCardSkins: Record<
  string,
  { card: string; iconWrap: string; badge: string; action: string }
> = {
  general: {
    card: "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/45",
    iconWrap: "bg-primary/15 text-primary",
    badge: "border-transparent bg-primary/15 text-primary",
    action: "border-primary/30 bg-primary/10 text-primary",
  },
  frontend: {
    card: "border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-card to-card hover:border-cyan-500/45",
    iconWrap: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    badge: "border-transparent bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    action: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  backend: {
    card: "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card hover:border-emerald-500/45",
    iconWrap: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    badge: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    action: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  fullstack: {
    card: "border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-card to-card hover:border-violet-500/45",
    iconWrap: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    badge: "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300",
    action: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  devops: {
    card: "border-slate-500/25 bg-gradient-to-br from-slate-500/10 via-card to-card hover:border-slate-500/45",
    iconWrap: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    badge: "border-transparent bg-slate-500/15 text-slate-700 dark:text-slate-300",
    action: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  data: {
    card: "border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-card hover:border-amber-500/45",
    iconWrap: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    badge: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    action: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  "ml-ai": {
    card: "border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 via-card to-card hover:border-fuchsia-500/45",
    iconWrap: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    badge: "border-transparent bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    action: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  },
  security: {
    card: "border-red-500/25 bg-gradient-to-br from-red-500/10 via-card to-card hover:border-red-500/45",
    iconWrap: "bg-red-500/15 text-red-700 dark:text-red-300",
    badge: "border-transparent bg-red-500/15 text-red-700 dark:text-red-300",
    action: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  testing: {
    card: "border-lime-500/25 bg-gradient-to-br from-lime-500/10 via-card to-card hover:border-lime-500/45",
    iconWrap: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
    badge: "border-transparent bg-lime-500/15 text-lime-700 dark:text-lime-300",
    action: "border-lime-500/30 bg-lime-500/10 text-lime-700 dark:text-lime-300",
  },
  api: {
    card: "border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-card to-card hover:border-indigo-500/45",
    iconWrap: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    badge: "border-transparent bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    action: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  automation: {
    card: "border-teal-500/25 bg-gradient-to-br from-teal-500/10 via-card to-card hover:border-teal-500/45",
    iconWrap: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    badge: "border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-300",
    action: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  docs: {
    card: "border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-card to-card hover:border-orange-500/45",
    iconWrap: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    badge: "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300",
    action: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
};

function PresetCard({ template }: { template: PromptTemplate }) {
  const skin = categoryCardSkins[template.category] ?? categoryCardSkins.general;
  const fields = [
    template.role && `Role: ${template.role}`,
    template.tone && `Tone: ${template.tone}`,
    template.complexity && `Complexity: ${template.complexity}`,
    template.format.length > 0 && `Format: ${template.format.join(", ")}`,
  ].filter(Boolean) as string[];

  return (
    <Card className={cn("interactive-card group overflow-hidden border", skin.card)}>
      <div className="p-3 sm:p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full text-sm", skin.iconWrap)}>
              {categoryIcons[template.category] ?? categoryIcons.general}
            </span>
            <h3 className="font-semibold text-sm text-foreground">{template.name}</h3>
            <Badge variant="outline" className={cn("text-xs capitalize", skin.badge)}>
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
            <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
          ))}
        </div>

        <div className="pt-1">
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn("h-11 gap-1.5 text-sm sm:h-9 sm:text-base", skin.action)}
          >
            <Link to={`/?preset=${template.id}`}>Use preset</Link>
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
      />

      <div className="mx-auto max-w-4xl space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search presets..."
            className="h-11 pl-9 sm:h-10"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
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
          <Card className="p-6 text-center border-dashed">
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
