import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
import { cn } from "@/lib/utils";
import { templates, categoryLabels, type PromptTemplate } from "@/lib/templates";
import type { PromptShareInput, PromptSummary } from "@/lib/persistence";
import {
  Sparkles,
  Layout,
  Server,
  Layers,
  Cloud,
  Database,
  Brain,
  Shield,
  FlaskConical,
  Cable,
  Bot,
  BookOpen,
  Trash2,
  Search,
  ArrowDownUp,
  Share2,
  Lock,
  GitBranch,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

interface PromptLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedPrompts: PromptSummary[];
  canShareSavedPrompts: boolean;
  onSelectTemplate: (template: PromptTemplate) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onShareSaved: (id: string, input?: PromptShareInput) => void | Promise<void>;
  onUnshareSaved: (id: string) => void | Promise<void>;
}

interface PromptLibraryContentProps {
  savedPrompts: PromptSummary[];
  canShareSavedPrompts: boolean;
  onSelectTemplate: (template: PromptTemplate) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onShareSaved: (id: string, input?: PromptShareInput) => void | Promise<void>;
  onUnshareSaved: (id: string) => void | Promise<void>;
  onClose?: () => void;
}

type SavedPromptSort = "recent" | "name" | "revision";

const categoryIcons: Record<string, React.ReactNode> = {
  general: <Sparkles className="w-4 h-4" />,
  frontend: <Layout className="w-4 h-4" />,
  backend: <Server className="w-4 h-4" />,
  fullstack: <Layers className="w-4 h-4" />,
  devops: <Cloud className="w-4 h-4" />,
  data: <Database className="w-4 h-4" />,
  "ml-ai": <Brain className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  testing: <FlaskConical className="w-4 h-4" />,
  api: <Cable className="w-4 h-4" />,
  automation: <Bot className="w-4 h-4" />,
  docs: <BookOpen className="w-4 h-4" />,
};

const categoryCardSkins: Record<
  string,
  {
    card: string;
    iconWrap: string;
    badge: string;
    action: string;
  }
> = {
  general: {
    card:
      "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/45",
    iconWrap: "bg-primary/15 text-primary",
    badge: "border-transparent bg-primary/15 text-primary",
    action: "border-primary/30 bg-primary/10 text-primary",
  },
  frontend: {
    card:
      "border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-card to-card hover:border-cyan-500/45",
    iconWrap: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    badge: "border-transparent bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    action: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  backend: {
    card:
      "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card hover:border-emerald-500/45",
    iconWrap: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    badge: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    action: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  fullstack: {
    card:
      "border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-card to-card hover:border-violet-500/45",
    iconWrap: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    badge: "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300",
    action: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  devops: {
    card:
      "border-slate-500/25 bg-gradient-to-br from-slate-500/10 via-card to-card hover:border-slate-500/45",
    iconWrap: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    badge: "border-transparent bg-slate-500/15 text-slate-700 dark:text-slate-300",
    action: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  data: {
    card:
      "border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-card hover:border-amber-500/45",
    iconWrap: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    badge: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    action: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  "ml-ai": {
    card:
      "border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 via-card to-card hover:border-fuchsia-500/45",
    iconWrap: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    badge: "border-transparent bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    action: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  },
  security: {
    card:
      "border-red-500/25 bg-gradient-to-br from-red-500/10 via-card to-card hover:border-red-500/45",
    iconWrap: "bg-red-500/15 text-red-700 dark:text-red-300",
    badge: "border-transparent bg-red-500/15 text-red-700 dark:text-red-300",
    action: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  testing: {
    card:
      "border-lime-500/25 bg-gradient-to-br from-lime-500/10 via-card to-card hover:border-lime-500/45",
    iconWrap: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
    badge: "border-transparent bg-lime-500/15 text-lime-700 dark:text-lime-300",
    action: "border-lime-500/30 bg-lime-500/10 text-lime-700 dark:text-lime-300",
  },
  api: {
    card:
      "border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-card to-card hover:border-indigo-500/45",
    iconWrap: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    badge: "border-transparent bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    action: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  automation: {
    card:
      "border-teal-500/25 bg-gradient-to-br from-teal-500/10 via-card to-card hover:border-teal-500/45",
    iconWrap: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    badge: "border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-300",
    action: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  docs: {
    card:
      "border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-card to-card hover:border-orange-500/45",
    iconWrap: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    badge: "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300",
    action: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
};

function formatUpdatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseTags(value: string): string[] | undefined {
  const tags = Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 8);

  return tags.length > 0 ? tags : undefined;
}

function PromptList({
  activeCategory,
  setActiveCategory,
  query,
  onQueryChange,
  sortBy,
  onSortByChange,
  savedPrompts,
  canShareSavedPrompts,
  onSelectTemplate,
  onSelectSaved,
  onDeleteSaved,
  onShareSaved,
  onUnshareSaved,
  onClose,
}: {
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sortBy: SavedPromptSort;
  onSortByChange: (sort: SavedPromptSort) => void;
  savedPrompts: PromptSummary[];
  canShareSavedPrompts: boolean;
  onSelectTemplate: (t: PromptTemplate) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onShareSaved: (id: string, input?: PromptShareInput) => void | Promise<void>;
  onUnshareSaved: (id: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const categories = ["all", ...Object.keys(categoryLabels)];
  const normalizedQuery = query.trim().toLowerCase();
  const [sharePrompt, setSharePrompt] = useState<PromptSummary | null>(null);
  const [shareName, setShareName] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareTags, setShareTags] = useState("");
  const [shareCategory, setShareCategory] = useState("general");
  const [shareUseCase, setShareUseCase] = useState("");
  const [shareTargetModel, setShareTargetModel] = useState("");
  const [shareConfirmedSafe, setShareConfirmedSafe] = useState(false);
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<PromptSummary | null>(null);

  const handleOpenShareDialog = (prompt: PromptSummary) => {
    setSharePrompt(prompt);
    setShareName(prompt.name);
    setShareDescription(prompt.description);
    setShareTags(prompt.tags.join(", "));
    setShareCategory(prompt.category || "general");
    setShareUseCase(prompt.useCase || "");
    setShareTargetModel(prompt.targetModel || "");
    setShareConfirmedSafe(false);
  };

  const handleCloseShareDialog = () => {
    setSharePrompt(null);
    setShareConfirmedSafe(false);
  };

  const handleConfirmDelete = () => {
    if (!pendingDeletePrompt) return;
    onDeleteSaved(pendingDeletePrompt.id);
    setPendingDeletePrompt(null);
  };

  const handleShareSavedPrompt = async () => {
    if (!sharePrompt) return;
    if (!shareName.trim() || !shareUseCase.trim() || !shareConfirmedSafe) return;

    await Promise.resolve(
      onShareSaved(sharePrompt.id, {
        title: shareName.trim(),
        description: shareDescription.trim() || undefined,
        category: shareCategory,
        tags: parseTags(shareTags),
        targetModel: shareTargetModel.trim() || undefined,
        useCase: shareUseCase.trim(),
      }),
    );
    handleCloseShareDialog();
  };

  const filteredSaved = useMemo(() => {
    const matches = savedPrompts.filter((prompt) => {
      if (!normalizedQuery) return true;
      const haystack = [prompt.name, prompt.description, prompt.tags.join(" "), prompt.starterPrompt, prompt.category]
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
  }, [savedPrompts, normalizedQuery, sortBy]);

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
          <label htmlFor="prompt-library-search" className="sr-only">
            Search saved prompts and templates
          </label>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            id="prompt-library-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search prompts by name, description, tags, or starter text"
            className="h-8 pl-8 text-sm bg-background"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowDownUp className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value: SavedPromptSort) => onSortByChange(value)}>
            <SelectTrigger className="h-8 text-sm min-w-[138px]" aria-label="Sort saved prompts">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent" className="text-sm">Most Recent</SelectItem>
              <SelectItem value="name" className="text-sm">Name (A-Z)</SelectItem>
              <SelectItem value="revision" className="text-sm">Revision (High)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-medium text-foreground">My Prompts</h3>
          <Badge variant="secondary" className="text-[11px]">
            {filteredSaved.length}
          </Badge>
        </div>

        {savedPrompts.length === 0 && (
          <Card className="border-dashed border-border/80 bg-muted/20 p-3">
            <p className="text-sm text-muted-foreground">
              No saved prompts yet. Create one in the Builder, then save it to your library.
            </p>
            <div className="mt-2">
              <Button asChild size="sm" className="h-8 text-xs" onClick={onClose}>
                <Link to="/">Go to Builder</Link>
              </Button>
            </div>
          </Card>
        )}

        {savedPrompts.length > 0 && filteredSaved.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No saved prompts match this search.
          </p>
        )}

        {filteredSaved.map((prompt) => (
          <Card
            key={prompt.id}
            className="interactive-card p-3 hover:border-primary/50 group"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="space-y-1 min-w-0 flex-1 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onSelectSaved(prompt.id);
                  onClose();
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {prompt.name}
                  </h4>
                  <Badge variant="outline" className="text-[11px]">
                    r{prompt.revision}
                  </Badge>
                  {prompt.isShared ? (
                    <Badge variant="secondary" className="text-[11px] gap-1">
                      <Share2 className="w-3 h-3" />
                      Shared
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] gap-1">
                      <Lock className="w-3 h-3" />
                      Private
                    </Badge>
                  )}
                  {prompt.remixedFrom && (
                    <Badge variant="secondary" className="text-[11px] gap-1">
                      <GitBranch className="w-3 h-3" />
                      Remixed
                    </Badge>
                  )}
                </div>
                {prompt.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{prompt.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground/90 line-clamp-2">
                  <span className="font-medium text-foreground/80">Start:</span> {prompt.starterPrompt}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="capitalize">{prompt.category || "general"}</span>
                  <span>•</span>
                  <span>{formatUpdatedAt(prompt.updatedAt)}</span>
                  <span>•</span>
                  <span>{prompt.sourceCount} sources</span>
                  <span>•</span>
                  <span>{prompt.databaseCount} DB</span>
                </div>
                {prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prompt.tags.slice(0, 4).map((tag) => (
                      <Badge key={`${prompt.id}-${tag}`} variant="outline" className="text-[11px]">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {prompt.isShared && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>▲ {prompt.upvoteCount}</span>
                    <span>✓ {prompt.verifiedCount}</span>
                    <span>🔀 {prompt.remixCount}</span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {prompt.commentCount}
                    </span>
                  </div>
                )}
              </button>
              <div className="flex flex-col gap-1">
                {prompt.isShared && prompt.communityPostId && (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                  >
                    <Link to={`/community/${prompt.communityPostId}`}>
                      Open
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </Button>
                )}
                {prompt.isShared ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onUnshareSaved(prompt.id);
                    }}
                  >
                    Unshare
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={!canShareSavedPrompts}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenShareDialog(prompt);
                    }}
                    title={!canShareSavedPrompts ? "Sign in to share prompts." : undefined}
                  >
                    Share
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingDeletePrompt(prompt);
                  }}
                  aria-label={`Delete ${prompt.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-foreground">Starter Templates</h3>
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
              <p className="text-sm text-muted-foreground">No starter templates match this search.</p>
            </Card>
          )}
          {filtered.map((template) => {
            const skin = categoryCardSkins[template.category] ?? categoryCardSkins.general;
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
                    onSelectTemplate(template);
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
                          {categoryIcons[template.category] ?? categoryIcons.general}
                        </span>
                        <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {template.name}
                        </h3>
                        <Badge variant="outline" className={cn("text-[11px] capitalize", skin.badge)}>
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                      <p className="text-[11px] text-muted-foreground/90 line-clamp-2">
                        <span className="font-medium text-foreground/80">Start:</span> {template.starterPrompt}
                      </p>
                      <div className="flex gap-1 mt-1.5">
                        <Badge variant="secondary" className="text-[11px]">
                          {template.tone}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px]">
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
      </div>

      <AlertDialog
        open={pendingDeletePrompt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeletePrompt(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletePrompt
                ? `This will permanently delete "${pendingDeletePrompt.name}".`
                : "This will permanently delete this saved prompt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={sharePrompt !== null}
        onOpenChange={(open) => {
          if (!open) handleCloseShareDialog();
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Share Prompt</DialogTitle>
            <DialogDescription>Publish this saved prompt to the community feed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={shareName}
              onChange={(event) => setShareName(event.target.value)}
              placeholder="Prompt title"
              className="bg-background"
            />
            <Select value={shareCategory} onValueChange={setShareCategory}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={shareDescription}
              onChange={(event) => setShareDescription(event.target.value)}
              placeholder="Description (optional)"
              className="min-h-[80px] bg-background"
            />
            <Input
              value={shareTags}
              onChange={(event) => setShareTags(event.target.value)}
              placeholder="Tags (comma-separated, optional)"
              className="bg-background"
            />
            <Textarea
              value={shareUseCase}
              onChange={(event) => setShareUseCase(event.target.value)}
              placeholder="Use case (required)"
              className="min-h-[90px] bg-background"
            />
            <Input
              value={shareTargetModel}
              onChange={(event) => setShareTargetModel(event.target.value)}
              placeholder="Target model (optional)"
              className="bg-background"
            />
            <div className="flex items-start gap-2">
              <Checkbox
                id="library-share-confirm-safe"
                checked={shareConfirmedSafe}
                onCheckedChange={(checked) => setShareConfirmedSafe(checked === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="library-share-confirm-safe"
                className="cursor-pointer text-xs leading-snug text-muted-foreground"
              >
                I confirm this prompt contains no secrets or private data.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseShareDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleShareSavedPrompt()}
              disabled={!shareName.trim() || !shareUseCase.trim() || !shareConfirmedSafe}
            >
              Share Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PromptLibrary({
  open,
  onOpenChange,
  savedPrompts,
  canShareSavedPrompts,
  onSelectTemplate,
  onSelectSaved,
  onDeleteSaved,
  onShareSaved,
  onUnshareSaved,
}: PromptLibraryProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Prompt Library</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-auto flex-1 flex flex-col">
            <PromptLibraryContent
              savedPrompts={savedPrompts}
              canShareSavedPrompts={canShareSavedPrompts}
              onSelectTemplate={onSelectTemplate}
              onSelectSaved={onSelectSaved}
              onDeleteSaved={onDeleteSaved}
              onShareSaved={onShareSaved}
              onUnshareSaved={onUnshareSaved}
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
          <DialogTitle className="text-foreground">Prompt Library</DialogTitle>
        </DialogHeader>
        <PromptLibraryContent
          savedPrompts={savedPrompts}
          canShareSavedPrompts={canShareSavedPrompts}
          onSelectTemplate={onSelectTemplate}
          onSelectSaved={onSelectSaved}
          onDeleteSaved={onDeleteSaved}
          onShareSaved={onShareSaved}
          onUnshareSaved={onUnshareSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function PromptLibraryContent({
  savedPrompts,
  canShareSavedPrompts,
  onSelectTemplate,
  onSelectSaved,
  onDeleteSaved,
  onShareSaved,
  onUnshareSaved,
  onClose,
}: PromptLibraryContentProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SavedPromptSort>("recent");
  const handleClose = onClose ?? (() => undefined);

  return (
    <PromptList
      activeCategory={activeCategory}
      setActiveCategory={setActiveCategory}
      query={query}
      onQueryChange={setQuery}
      sortBy={sortBy}
      onSortByChange={setSortBy}
      savedPrompts={savedPrompts}
      canShareSavedPrompts={canShareSavedPrompts}
      onSelectTemplate={onSelectTemplate}
      onSelectSaved={onSelectSaved}
      onDeleteSaved={onDeleteSaved}
      onShareSaved={onShareSaved}
      onUnshareSaved={onUnshareSaved}
      onClose={handleClose}
    />
  );
}
