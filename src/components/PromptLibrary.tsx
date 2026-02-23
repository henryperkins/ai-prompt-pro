import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/base/primitives/alert-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/base/drawer";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Card } from "@/components/base/primitives/card";
import { Checkbox } from "@/components/base/primitives/checkbox";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/label";
import { Textarea } from "@/components/base/textarea";
import { Select } from "@/components/base/select/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
import { cn } from "@/lib/utils";
import {
  templates,
  categoryLabels,
  promptCategorySkins,
  type PromptTemplate,
} from "@/lib/templates";
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

const savedPromptActionButtonClass =
  "h-10 min-w-[84px] rounded-md px-2.5 text-xs font-medium tracking-tight sm:h-8 sm:min-w-[72px] sm:px-2";
const savedPromptIconButtonClass =
  "h-10 w-10 rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:h-8 sm:w-8";

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
      <div className="grid grid-cols-1 gap-2 border-b border-border/60 pb-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <label htmlFor="prompt-library-search" className="sr-only">
            Search saved prompts and templates
          </label>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            id="prompt-library-search"
            value={query}
            onChange={onQueryChange}
            placeholder="Search prompts by name, description, tags, or starter text"
            wrapperClassName="h-11 bg-background sm:h-9"
            inputClassName="pl-8"
          />
        </div>
        <div className="flex items-center gap-1">
          <ArrowDownUp className="w-3.5 h-3.5 text-muted-foreground" />
          <Select
            selectedKey={sortBy}
            onSelectionChange={(value) => {
              if (value !== null) {
                onSortByChange(String(value) as SavedPromptSort);
              }
            }}
            aria-label="Sort saved prompts"
            className="min-w-[138px]"
            size="md"
          >
            <Select.Item id="recent">Most Recent</Select.Item>
            <Select.Item id="name">Name (A-Z)</Select.Item>
            <Select.Item id="revision">Revision (High)</Select.Item>
          </Select>
        </div>
      </div>

      <div className="space-y-2 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-medium text-foreground">My Prompts</h3>
          <Badge type="modern" className="text-xs">
            {filteredSaved.length}
          </Badge>
        </div>

        {savedPrompts.length === 0 && (
          <Card className="border-dashed border-border/80 bg-muted/20 p-3">
            <p className="text-sm text-muted-foreground">
              No saved prompts yet. Create one in the Builder, then save it to your library.
            </p>
            <div className="mt-2">
              <Button size="sm" href="/" className="h-11 text-sm sm:h-8 sm:text-sm" onClick={onClose}>
                Go to Builder
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
          <Card key={prompt.id} className="interactive-card group border-border/70 bg-card/90 p-3 hover:border-primary/45">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 space-y-1.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onSelectSaved(prompt.id);
                  onClose();
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {prompt.name}
                  </h4>
                  <Badge type="modern" className="border border-border bg-background text-foreground text-xs">
                    r{prompt.revision}
                  </Badge>
                  {prompt.isShared ? (
                    <Badge type="modern" className="text-xs gap-1">
                      <Share2 className="w-3 h-3" />
                      Shared
                    </Badge>
                  ) : (
                    <Badge type="modern" className="border border-border bg-background text-foreground text-xs gap-1">
                      <Lock className="w-3 h-3" />
                      Private
                    </Badge>
                  )}
                  {prompt.remixedFrom && (
                    <Badge type="modern" className="text-xs gap-1">
                      <GitBranch className="w-3 h-3" />
                      Remixed
                    </Badge>
                  )}
                </div>
                {prompt.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{prompt.description}</p>
                )}
                <p className="text-xs text-muted-foreground/90 line-clamp-2">
                  <span className="font-medium text-foreground/80">Start:</span> {prompt.starterPrompt}
                </p>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
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
                      <Badge key={`${prompt.id}-${tag}`} type="modern" className="border border-border bg-background text-foreground text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {prompt.isShared && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
              <div className="flex shrink-0 flex-col gap-1 rounded-md border border-border/70 bg-background/70 p-1">
                {prompt.isShared && prompt.communityPostId && (
                  <Button
                    color="tertiary"
                    size="sm"
                    className={cn(savedPromptActionButtonClass, "gap-1.5 text-muted-foreground hover:text-foreground")}
                    href={`/community/${prompt.communityPostId}`}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    Open
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
                {prompt.isShared ? (
                  <Button
                    color="secondary"
                    size="sm"
                    className={cn(savedPromptActionButtonClass, "border-border/70 bg-background/60")}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onUnshareSaved(prompt.id);
                    }}
                  >
                    Unshare
                  </Button>
                ) : (
                  <Button
                    color="secondary"
                    size="sm"
                    className={cn(savedPromptActionButtonClass, "border-border/70 bg-background/60")}
                    isDisabled={!canShareSavedPrompts}
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
                  color="tertiary"
                  size="sm"
                  className={savedPromptIconButtonClass}
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

        <div className="flex flex-wrap gap-1.5 py-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              color={activeCategory === cat ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="interactive-chip h-10 gap-1.5 rounded-full px-3 text-xs font-medium capitalize tracking-tight sm:h-8 sm:px-2.5 sm:text-sm"
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
            const skin = promptCategorySkins[template.category] ?? promptCategorySkins.general;
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
                  className="w-full rounded-sm p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-3.5"
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
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {template.name}
                        </h3>
                        <Badge
                          type="modern"
                          className={cn("border border-border bg-background text-foreground text-xs capitalize", skin.badge)}
                        >
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                      <p className="text-xs text-muted-foreground/90 line-clamp-2">
                        <span className="font-medium text-foreground/80">Start:</span> {template.starterPrompt}
                      </p>
                      <div className="mt-1.5 flex gap-1">
                        <Badge type="modern" className="text-2xs">
                          {template.tone}
                        </Badge>
                        <Badge type="modern" className="text-2xs">
                          {template.complexity}
                        </Badge>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "type-label-caps hidden h-8 shrink-0 items-center rounded-md border px-2 text-2xs font-medium opacity-70 transition-opacity group-hover:opacity-100 sm:inline-flex",
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
              variant="brandDestructive"
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
              onChange={setShareName}
              placeholder="Prompt title"
              wrapperClassName="bg-background"
              inputClassName="text-base"
            />
            <Select
              selectedKey={shareCategory}
              onSelectionChange={(value) => {
                if (value !== null) {
                  setShareCategory(String(value));
                }
              }}
              placeholder="Category"
              className="bg-background"
              aria-label="Category"
            >
              {PROMPT_CATEGORY_OPTIONS.map((category) => (
                <Select.Item key={category.value} id={category.value}>
                  {category.label}
                </Select.Item>
              ))}
            </Select>
            <Textarea
              value={shareDescription}
              onChange={(event) => setShareDescription(event.target.value)}
              placeholder="Description (optional)"
              className="min-h-[80px] bg-background"
            />
            <Input
              value={shareTags}
              onChange={setShareTags}
              placeholder="Tags (comma-separated, optional)"
              wrapperClassName="bg-background"
              inputClassName="text-base"
            />
            <Textarea
              value={shareUseCase}
              onChange={(event) => setShareUseCase(event.target.value)}
              placeholder="Use case (required)"
              className="min-h-[90px] bg-background"
            />
            <Input
              value={shareTargetModel}
              onChange={setShareTargetModel}
              placeholder="Target model (optional)"
              wrapperClassName="bg-background"
              inputClassName="text-base"
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
            <Button color="secondary" onClick={handleCloseShareDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleShareSavedPrompt()}
              isDisabled={!shareName.trim() || !shareUseCase.trim() || !shareConfirmedSafe}
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
            <DrawerDescription className="sr-only">
              Browse templates and saved prompts, then load one into the builder.
            </DrawerDescription>
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
          <DialogDescription>
            Browse templates and saved prompts, then load one into the builder.
          </DialogDescription>
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
