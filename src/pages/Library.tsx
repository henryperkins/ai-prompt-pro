import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDownUp, Database, ExternalLink, GitBranch, Lock, Search, Share2, Sparkles } from "lucide-react";
import { PageHero, PageShell } from "@/components/PageShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StateCard } from "@/components/ui/state-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useToast } from "@/hooks/use-toast";
import {
  getInitials,
  getUserAvatarUrl,
  getUserDisplayName,
  encodeSelectionIds,
} from "@/lib/library-pages";
import * as persistence from "@/lib/persistence";

type SavedPromptSort = "recent" | "name" | "revision";

function formatUpdatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function resolveShareUseCase(prompt: persistence.PromptSummary): string | undefined {
  const candidates = [prompt.useCase, prompt.description, prompt.starterPrompt];
  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (normalized) return normalized;
  }
  return undefined;
}

const Library = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const ownerName = getUserDisplayName(user);
  const ownerAvatarUrl = getUserAvatarUrl(user);
  const {
    templateSummaries,
    isSignedIn,
    deleteSavedTemplate,
    shareSavedPrompt,
    unshareSavedPrompt,
  } = usePromptBuilder();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SavedPromptSort>("recent");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const normalizedQuery = query.trim().toLowerCase();
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const categories = useMemo(() => {
    const known = Array.from(
      new Set(
        templateSummaries
          .map((prompt) => (prompt.category || "general").trim().toLowerCase())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return ["all", ...known];
  }, [templateSummaries]);

  const filteredSaved = useMemo(() => {
    const matchesCategory =
      activeCategory === "all"
        ? templateSummaries
        : templateSummaries.filter((prompt) => (prompt.category || "general").toLowerCase() === activeCategory);

    const matchesQuery = matchesCategory.filter((prompt) => {
      if (!normalizedQuery) return true;
      const haystack = [prompt.name, prompt.description, prompt.tags.join(" "), prompt.starterPrompt, prompt.category]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    const sorted = [...matchesQuery];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "revision") {
      sorted.sort((a, b) => b.revision - a.revision);
    } else {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return sorted;
  }, [activeCategory, normalizedQuery, sortBy, templateSummaries]);

  const selectedCount = selectedIds.length;
  const allFilteredSelected = filteredSaved.length > 0 && filteredSaved.every((prompt) => selectedSet.has(prompt.id));
  const hasActiveFilters = Boolean(normalizedQuery) || activeCategory !== "all";

  const applySelection = useCallback((ids: string[]) => {
    setSelectedIds(Array.from(new Set(ids)));
  }, []);

  const togglePromptSelection = useCallback(
    (id: string, checked: boolean) => {
      applySelection(checked ? [...selectedIds, id] : selectedIds.filter((value) => value !== id));
    },
    [applySelection, selectedIds],
  );

  const toggleSelectAllFiltered = useCallback(
    (checked: boolean) => {
      const filteredIds = filteredSaved.map((prompt) => prompt.id);
      if (!checked) {
        applySelection(selectedIds.filter((id) => !filteredIds.includes(id)));
        return;
      }
      applySelection([...selectedIds, ...filteredIds]);
    },
    [applySelection, filteredSaved, selectedIds],
  );

  const handleSelectSaved = useCallback(
    async (id: string) => {
      try {
        const loaded = await persistence.loadPromptById(userId, id);
        if (!loaded) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }

        await persistence.saveDraft(userId, loaded.record.state.promptConfig);
        toast({
          title: `Prompt loaded: ${loaded.record.metadata.name}`,
          description:
            loaded.warnings.length > 0
              ? `${loaded.warnings.length} context warning(s).`
              : "Prompt restored successfully.",
        });
        navigate("/");
      } catch (error) {
        toast({
          title: "Failed to load prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [navigate, toast, userId],
  );

  const handleDeleteSaved = useCallback(
    async (id: string) => {
      try {
        const deleted = await deleteSavedTemplate(id);
        if (!deleted) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        setSelectedIds((prev) => prev.filter((value) => value !== id));
        toast({ title: "Saved prompt deleted" });
      } catch (error) {
        toast({
          title: "Failed to delete prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [deleteSavedTemplate, toast],
  );

  const handleShareSaved = useCallback(
    async (prompt: persistence.PromptSummary) => {
      if (!isSignedIn) {
        toast({ title: "Sign in required", description: "Sign in to share prompts.", variant: "destructive" });
        return;
      }
      const shareUseCase = resolveShareUseCase(prompt);
      if (!shareUseCase) {
        toast({
          title: "Missing share metadata",
          description: "Load this prompt, add a use case, then try sharing again.",
          variant: "destructive",
        });
        return;
      }
      try {
        const result = await shareSavedPrompt(prompt.id, { useCase: shareUseCase });
        if (!result.shared) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({
          title: "Prompt shared to community",
          action: result.postId ? (
            <ToastAction altText="View post" asChild>
              <Link to={`/community/${result.postId}`}>View</Link>
            </ToastAction>
          ) : undefined,
        });
      } catch (error) {
        toast({
          title: "Failed to share prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [isSignedIn, shareSavedPrompt, toast],
  );

  const handleUnshareSaved = useCallback(
    async (id: string) => {
      try {
        const unshared = await unshareSavedPrompt(id);
        if (!unshared) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({ title: "Prompt removed from community" });
      } catch (error) {
        toast({
          title: "Failed to unshare prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [toast, unshareSavedPrompt],
  );

  const openBulkEdit = useCallback(() => {
    const params = encodeSelectionIds(selectedIds);
    navigate(`/library/bulk-edit?${params.toString()}`);
  }, [navigate, selectedIds]);

  const resetFilters = useCallback(() => {
    setQuery("");
    setActiveCategory("all");
  }, []);

  return (
    <PageShell>
      <PageHero
        title="Library Workspace"
        subtitle="Manage saved prompts here. Presets stay in Builder."
      />

      <div className="space-y-4">
        <Card className="border-border/80 bg-card/85 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="type-label-caps text-xs font-semibold text-primary">Saved prompts only</p>
              <p className="text-sm text-muted-foreground">
                Edit saved prompts without changing presets.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-11 gap-1 text-sm sm:h-9 sm:text-base">
              <Link to="/">
                <Sparkles className="h-3.5 w-3.5" />
                Open Builder Presets
              </Link>
            </Button>
          </div>
        </Card>

        <Card className="border-border/80 bg-card/85 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-2 border-b border-border/60 pb-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div className="relative">
              <label htmlFor="library-page-search" className="sr-only">
                Search saved prompts
              </label>
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="library-page-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, tag, or text"
                className="h-11 bg-background pl-8 text-sm sm:h-10"
              />
            </div>

            <Select value={activeCategory} onValueChange={setActiveCategory}>
              <SelectTrigger className="h-11 min-w-[140px] text-sm capitalize sm:h-10 sm:text-base" aria-label="Filter category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category} className="text-sm capitalize sm:text-base">
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(value: SavedPromptSort) => setSortBy(value)}>
                <SelectTrigger className="h-11 min-w-[138px] text-sm sm:h-10 sm:text-base" aria-label="Sort saved prompts">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent" className="text-sm sm:text-base">Most Recent</SelectItem>
                  <SelectItem value="name" className="text-sm sm:text-base">Name (A-Z)</SelectItem>
                  <SelectItem value="revision" className="text-sm sm:text-base">Revision (High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={(checked) => toggleSelectAllFiltered(checked === true)}
                    aria-label="Select all filtered prompts"
                  />
                  <span>{selectedCount} selected for bulk edit</span>
                  <Badge variant="secondary" className="text-xs">
                    {filteredSaved.length} shown
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-11 text-sm sm:h-9 sm:text-base"
                  disabled={selectedCount === 0}
                  onClick={openBulkEdit}
                >
                  Open Bulk Edit
                </Button>
              </div>
            </div>

            {templateSummaries.length === 0 && (
              <StateCard
                variant="empty"
                title="No saved prompts yet"
                description="Create one in Builder, then save it to your library."
                primaryAction={{ label: "Go to Builder", to: "/" }}
              />
            )}

            {templateSummaries.length > 0 && filteredSaved.length === 0 && (
              <StateCard
                variant="empty"
                title="No saved prompts match."
                description="Try another search term or reset the category filter."
                primaryAction={
                  hasActiveFilters
                    ? { label: "Reset filters", onClick: resetFilters }
                    : { label: "Go to Builder", to: "/" }
                }
                secondaryAction={{ label: "Go to Builder", to: "/" }}
              />
            )}

            <div className="space-y-2">
              {filteredSaved.map((prompt) => {
                const isSelected = selectedSet.has(prompt.id);
                const shareUseCase = resolveShareUseCase(prompt);
                return (
                  <Card
                    key={prompt.id}
                    className={`interactive-card p-3 transition-colors ${
                      isSelected ? "border-primary/45 bg-primary/5" : "hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => togglePromptSelection(prompt.id, checked === true)}
                        aria-label={`Select ${prompt.name}`}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="h-7 w-7 border border-border/60">
                            <AvatarImage src={ownerAvatarUrl ?? undefined} alt={ownerName} />
                            <AvatarFallback className="text-xs">{getInitials(ownerName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-medium text-foreground">{prompt.name}</h3>
                              <Badge variant="outline" className="text-xs">
                                r{prompt.revision}
                              </Badge>
                              {prompt.isShared ? (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Share2 className="h-3 w-3" />
                                  Shared
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Lock className="h-3 w-3" />
                                  Private
                                </Badge>
                              )}
                              {prompt.remixedFrom && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <GitBranch className="h-3 w-3" />
                                  Remixed
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{ownerName}</p>
                          </div>
                        </div>

                        {prompt.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{prompt.description}</p>
                        )}
                        <p className="line-clamp-2 text-xs text-muted-foreground/90">
                          <span className="font-medium text-foreground/80">Start:</span> {prompt.starterPrompt}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="capitalize">{prompt.category || "general"}</span>
                          <span>•</span>
                          <span>{formatUpdatedAt(prompt.updatedAt)}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <Database className="h-3.5 w-3.5" />
                            {prompt.sourceCount} src / {prompt.databaseCount} db
                          </span>
                        </div>
                        {prompt.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {prompt.tags.slice(0, 5).map((tag) => (
                              <Badge key={`${prompt.id}-${tag}`} variant="outline" className="text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="h-11 px-2.5 text-sm sm:h-9 sm:text-base"
                          onClick={() => void handleSelectSaved(prompt.id)}
                        >
                          Load
                        </Button>
                        {prompt.isShared && prompt.communityPostId && (
                          <Button asChild variant="ghost" size="sm" className="h-11 px-2.5 text-sm sm:h-9 sm:text-base">
                            <Link to={`/community/${prompt.communityPostId}`}>
                              Open
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                        {prompt.isShared ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-11 px-2.5 text-sm sm:h-9 sm:text-base"
                            onClick={() => void handleUnshareSaved(prompt.id)}
                          >
                            Unshare
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-11 px-2.5 text-sm sm:h-9 sm:text-base"
                            disabled={!isSignedIn || !shareUseCase}
                            onClick={() => void handleShareSaved(prompt)}
                            title={
                              !isSignedIn
                                ? "Sign in to share prompts."
                                : !shareUseCase
                                  ? "Add prompt context before sharing."
                                  : undefined
                            }
                          >
                            Share
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-11 px-2.5 text-sm text-destructive hover:text-destructive sm:h-9 sm:text-base"
                          onClick={() => void handleDeleteSaved(prompt.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  );
};

export default Library;
