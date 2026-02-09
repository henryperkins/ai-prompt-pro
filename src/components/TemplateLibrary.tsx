import { useState } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
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
} from "lucide-react";

interface TemplateLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedTemplates: TemplateSummary[];
  onSelectPreset: (template: PromptTemplate) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  content: <FileText className="w-4 h-4" />,
  analysis: <TrendingUp className="w-4 h-4" />,
  creative: <Palette className="w-4 h-4" />,
  business: <Briefcase className="w-4 h-4" />,
  education: <GraduationCap className="w-4 h-4" />,
};

function TemplateList({
  activeCategory,
  setActiveCategory,
  savedTemplates,
  onSelectPreset,
  onSelectSaved,
  onDeleteSaved,
  onClose,
}: {
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  savedTemplates: TemplateSummary[];
  onSelectPreset: (t: PromptTemplate) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onClose: () => void;
}) {
  const categories = ["all", ...Object.keys(categoryLabels)];
  const filtered =
    activeCategory === "all"
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  return (
    <>
      <div className="space-y-2 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-medium text-foreground">Saved Templates</h3>
          <Badge variant="secondary" className="text-[10px]">
            {savedTemplates.length}
          </Badge>
        </div>

        {savedTemplates.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No saved templates yet. Use "Save Template" from the output panel.
          </p>
        )}

        {savedTemplates.map((template) => (
          <Card
            key={template.id}
            className="p-3 hover:border-primary/50 transition-all cursor-pointer group"
            onClick={() => {
              onSelectSaved(template.id);
              onClose();
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
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
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{template.sourceCount} sources</span>
                  <span>•</span>
                  <span>{template.databaseCount} DB</span>
                  <span>•</span>
                  <span>{template.ragEnabled ? "RAG on" : "RAG off"}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 opacity-0 group-hover:opacity-100"
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
            className="gap-1.5 text-xs capitalize h-7 sm:h-8"
          >
            {cat !== "all" && categoryIcons[cat]}
            {cat === "all" ? "All" : categoryLabels[cat]}
          </Button>
        ))}
      </div>

      <div className="overflow-y-auto flex-1 space-y-2 sm:space-y-3 pr-1">
        {filtered.map((template) => (
          <Card
            key={template.id}
            className="p-3 sm:p-4 hover:border-primary/50 transition-all cursor-pointer group"
            onClick={() => {
              onSelectPreset(template);
              onClose();
            }}
          >
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                    {template.name}
                  </h3>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {template.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                <div className="flex gap-1 mt-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {template.tone}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {template.complexity}
                  </Badge>
                </div>
              </div>
              <Button variant="soft" size="sm" className="shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex">
                Use
              </Button>
            </div>
          </Card>
        ))}
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
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Template Library</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-auto flex-1 flex flex-col">
            <TemplateList
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
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
          <DialogTitle className="text-foreground">Template Library</DialogTitle>
        </DialogHeader>
        <TemplateList
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
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
