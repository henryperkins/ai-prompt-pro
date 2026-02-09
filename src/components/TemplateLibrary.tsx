import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { templates, categoryLabels, type PromptTemplate } from "@/lib/templates";
import type { TemplateSummary } from "@/lib/template-store";
import {
  FileText,
  TrendingUp,
  Palette,
  Briefcase,
  GraduationCap,
  Database,
  Trash2,
  Search,
  ArrowDownUp,
} from "lucide-react";

interface TemplateLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedTemplates: TemplateSummary[];
  onSelectPreset: (template: PromptTemplate) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
}

type SavedTemplateSort = "recent" | "name" | "revision";

const categoryIcons: Record<string, React.ReactNode> = {
  content: <FileText className="w-4 h-4" />,
  analysis: <TrendingUp className="w-4 h-4" />,
  creative: <Palette className="w-4 h-4" />,
  business: <Briefcase className="w-4 h-4" />,
  education: <GraduationCap className="w-4 h-4" />,
};

const categoryCardSkins: Record<
  PromptTemplate["category"],
  {
    card: string;
    iconWrap: string;
    badge: string;
    action: string;
  }
> = {
  content: {
    card:
      "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/45",
    iconWrap: "bg-primary/15 text-primary",
    badge: "border-transparent bg-primary/15 text-primary",
    action: "border-primary/30 bg-primary/10 text-primary",
  },
  analysis: {
    card:
      "border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-card to-card hover:border-cyan-500/45",
    iconWrap: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    badge: "border-transparent bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    action: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  creative: {
    card:
      "border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-card hover:border-amber-500/45",
    iconWrap: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    badge: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    action: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  business: {
    card:
      "border-slate-500/25 bg-gradient-to-br from-slate-500/10 via-card to-card hover:border-slate-500/45",
    iconWrap: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    badge: "border-transparent bg-slate-500/15 text-slate-700 dark:text-slate-300",
    action: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  education: {
    card:
      "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card hover:border-emerald-500/45",
    iconWrap: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    badge: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    action: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

function TemplateList({
  activeCategory,
  setActiveCategory,
  query,
  onQueryChange,
  sortBy,
  onSortByChange,
  savedTemplates,
  onSelectPreset,
  onSelectSaved,
  onDeleteSaved,
  onClose,
}: {
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sortBy: SavedTemplateSort;
  onSortByChange: (sort: SavedTemplateSort) => void;
  savedTemplates: TemplateSummary[];
  onSelectPreset: (t: PromptTemplate) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onClose: () => void;
}) {
  const categories = ["all", ...Object.keys(categoryLabels)];
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSaved = useMemo(() => {
    const matches = savedTemplates.filter((template) => {
      if (!normalizedQuery) return true;
      const haystack = [
        template.name,
        template.description,
        template.tags.join(" "),
        template.starterPrompt,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    const sorted = [...matches];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "revision") {
      sorted.sort((a, b) => b.revision - a.revision);
    } else {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return sorted;
  }, [savedTemplates, normalizedQuery, sortBy]);

  const filtered = useMemo(() => {
    const scoped =
      activeCategory === "all"
        ? templates
        : templates.filter((template) => template.category === activeCategory);

    return scoped.filter((template) => {
      if (!normalizedQuery) return true;
      const haystack = [
        template.name,
        template.description,
        template.starterPrompt,
        template.category,
        template.tone,
        template.complexity,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeCategory, normalizedQuery]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 pb-2 border-b border-border/60">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search presets by name, description, tags, or starter text"
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowDownUp className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value: SavedTemplateSort) => onSortByChange(value)}>
            <SelectTrigger className="h-8 text-xs min-w-[138px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent" className="text-xs">Most Recent</SelectItem>
              <SelectItem value="name" className="text-xs">Name (A-Z)</SelectItem>
              <SelectItem value="revision" className="text-xs">Revision (High)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-medium text-foreground">Saved Presets</h3>
          <Badge variant="secondary" className="text-[10px]">
            {filteredSaved.length}
          </Badge>
        </div>

        {savedTemplates.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No saved presets yet. Use "Save Preset" from the output panel.
          </p>
        )}

        {savedTemplates.length > 0 && filteredSaved.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No saved presets match this search.
          </p>
        )}

        {filteredSaved.map((template) => (
          <Card
            key={template.id}
            className="interactive-card p-3 hover:border-primary/50 group"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="space-y-1 min-w-0 flex-1 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onSelectSaved(template.id);
                  onClose();
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {template.name}
                  </h4>
                  <Badge variant="outline" className="text-[10px]">
                    r{template.revision}
                  </Badge>
                </div>
                {template.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground/90 line-clamp-2">
                  <span className="font-medium text-foreground/80">Start:</span> {template.starterPrompt}
                </p>
                {template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.tags.slice(0, 4).map((tag) => (
                      <Badge key={`${template.id}-${tag}`} variant="outline" className="text-[10px]">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{template.sourceCount} sources</span>
                  <span>•</span>
                  <span>{template.databaseCount} DB</span>
                  <span>•</span>
                  <span>{template.ragEnabled ? "RAG on" : "RAG off"}</span>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteSaved(template.id);
                }}
                aria-label={`Delete ${template.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-2 py-2">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(cat)}
            className="interactive-chip gap-1.5 text-xs capitalize h-7 sm:h-8"
          >
            {cat !== "all" && categoryIcons[cat]}
            {cat === "all" ? "All" : categoryLabels[cat]}
          </Button>
        ))}
      </div>

      <div className="overflow-y-auto flex-1 space-y-2 sm:space-y-3 pr-1">
        {filtered.length === 0 && (
          <Card className="p-4 text-center border-dashed">
            <p className="text-sm text-muted-foreground">No preset templates match this search.</p>
          </Card>
        )}
        {filtered.map((template) => {
          const skin = categoryCardSkins[template.category];
          return (
            <Card
              key={template.id}
              className={cn(
                "interactive-card group overflow-hidden border",
                skin.card,
              )}
            >
              <button
                type="button"
                className="w-full p-3 sm:p-4 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onSelectPreset(template);
                  onClose();
                }}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full",
                          skin.iconWrap,
                        )}
                      >
                        {categoryIcons[template.category]}
                      </span>
                      <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                        {template.name}
                      </h3>
                      <Badge variant="outline" className={cn("text-[10px] capitalize", skin.badge)}>
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    <p className="text-[11px] text-muted-foreground/90 line-clamp-2">
                      <span className="font-medium text-foreground/80">Start:</span> {template.starterPrompt}
                    </p>
                    <div className="flex gap-1 mt-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {template.tone}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {template.complexity}
                      </Badge>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center rounded-md border px-2.5 h-8",
                      skin.action,
                    )}
                  >
                    Use
                  </span>
                </div>
              </button>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export function TemplateLibrary({
  open,
  onOpenChange,
  savedTemplates,
  onSelectPreset,
  onSelectSaved,
  onDeleteSaved,
}: TemplateLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SavedTemplateSort>("recent");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Preset Library</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-auto flex-1 flex flex-col">
            <TemplateList
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              query={query}
              onQueryChange={setQuery}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              savedTemplates={savedTemplates}
              onSelectPreset={onSelectPreset}
              onSelectSaved={onSelectSaved}
              onDeleteSaved={onDeleteSaved}
              onClose={() => onOpenChange(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">Preset Library</DialogTitle>
        </DialogHeader>
        <TemplateList
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          query={query}
          onQueryChange={setQuery}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          savedTemplates={savedTemplates}
          onSelectPreset={onSelectPreset}
          onSelectSaved={onSelectSaved}
          onDeleteSaved={onDeleteSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
