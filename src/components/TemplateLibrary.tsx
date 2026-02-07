import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { templates, categoryLabels, type PromptTemplate } from "@/lib/templates";
import { FileText, TrendingUp, Palette, Briefcase, GraduationCap } from "lucide-react";

interface TemplateLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: PromptTemplate) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  content: <FileText className="w-4 h-4" />,
  analysis: <TrendingUp className="w-4 h-4" />,
  creative: <Palette className="w-4 h-4" />,
  business: <Briefcase className="w-4 h-4" />,
  education: <GraduationCap className="w-4 h-4" />,
};

export function TemplateLibrary({ open, onOpenChange, onSelect }: TemplateLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const categories = ["all", ...Object.keys(categoryLabels)];

  const filtered =
    activeCategory === "all"
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">Template Library</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="gap-1.5 text-xs capitalize"
            >
              {cat !== "all" && categoryIcons[cat]}
              {cat === "all" ? "All" : categoryLabels[cat]}
            </Button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {filtered.map((template) => (
            <Card
              key={template.id}
              className="p-4 hover:border-primary/50 transition-all cursor-pointer group"
              onClick={() => {
                onSelect(template);
                onOpenChange(false);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                      {template.name}
                    </h3>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {template.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                  <div className="flex gap-1 mt-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {template.tone}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {template.complexity}
                    </Badge>
                  </div>
                </div>
                <Button variant="soft" size="sm" className="shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  Use
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
