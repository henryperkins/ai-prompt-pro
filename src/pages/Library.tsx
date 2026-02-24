import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PageHero, PageShell } from "@/components/PageShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/base/primitives/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
import { Checkbox } from "@/components/base/primitives/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/base/primitives/dropdown-menu";
import { Input } from "@/components/base/input/input";
import { StateCard } from "@/components/base/primitives/state-card";
import { Select } from "@/components/base/select/select";
import { ToastAction } from "@/components/base/primitives/toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useToast } from "@/hooks/use-toast";
import { brandCopy } from "@/lib/brand-copy";
import { getLibraryPromptRarity } from "@/lib/community-rarity";
import {
  getInitials,
  getUserAvatarUrl,
  getUserDisplayName,
} from "@/lib/library-pages";
import * as persistence from "@/lib/persistence";
import { PFTemplateCard } from "@/components/fantasy/PFTemplateCard";
import {
  ArrowSquareOut as ExternalLink,
  ArrowsDownUp as ArrowDownUp,
  Database,
  DotsThreeOutline as MoreHorizontal,
  GitBranch,
  Lock,
  MagnifyingGlass as Search,
  ShareNetwork as Share2,
  Sparkle as Sparkles,
} from "@phosphor-icons/react";

type SavedPromptSort = "recent" | "name" | "revision";
const LIBRARY_VIRTUALIZATION_THRESHOLD = 50;
const LIBRARY_SELECTION_STORAGE_KEY = "library-selection-ids";

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

function normalizeSelectionIds(ids: string[]): string[] {
  return Array.from(
    new Set(
      ids
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}

function loadSelectionFromSession(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(LIBRARY_SELECTION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return normalizeSelectionIds(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return [];
  }
}

const Library = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const ownerName = getUserDisplayName(user);
  const ownerAvatarUrl = getUserAvatarUrl(user);
  const isMobile = useIsMobile();
  const {
    templateSummaries,
    isSignedIn,
    deleteSavedTemplate,
    deleteSavedTemplates,
    shareSavedPrompt,
    unshareSavedPrompt,
    unshareSavedPrompts,
  } = usePromptBuilder();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SavedPromptSort>("recent");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => loadSelectionFromSession());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUnsharing, setIsBulkUnsharing] = useState(false);

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

  const visibleSaved = useMemo(() => {
    if (!showSelectedOnly) return filteredSaved;
    return filteredSaved.filter((prompt) => selectedSet.has(prompt.id));
  }, [filteredSaved, selectedSet, showSelectedOnly]);
  const featuredPrompts = useMemo(
    () => [...templateSummaries].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3),
    [templateSummaries],
  );

  const promptById = useMemo(() => new Map(templateSummaries.map((prompt) => [prompt.id, prompt])), [templateSummaries]);
  const selectedPrompts = useMemo(
    () => selectedIds.map((id) => promptById.get(id)).filter(Boolean),
    [promptById, selectedIds],
  );
  const selectedCount = selectedIds.length;
  const allFilteredSelected = filteredSaved.length > 0 && filteredSaved.every((prompt) => selectedSet.has(prompt.id));
  const hasActiveFilters = Boolean(normalizedQuery) || activeCategory !== "all" || showSelectedOnly;
  const shouldVirtualize = visibleSaved.length >= LIBRARY_VIRTUALIZATION_THRESHOLD;
  const isSelectionMode = selectedCount > 0;
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? visibleSaved.length : 0,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 248,
    overscan: 6,
    measureElement: (element) => element.getBoundingClientRect().height,
    enabled: shouldVirtualize,
  });

  useEffect(() => {
    if (templateSummaries.length === 0) return;
    setSelectedIds((prev) => {
      const next = prev.filter((id) => promptById.has(id));
      if (next.length === prev.length) return prev;
      if (typeof window !== "undefined") {
        if (next.length > 0) {
          window.sessionStorage.setItem(LIBRARY_SELECTION_STORAGE_KEY, JSON.stringify(next));
        } else {
          window.sessionStorage.removeItem(LIBRARY_SELECTION_STORAGE_KEY);
        }
      }
      return next;
    });
  }, [promptById, templateSummaries.length]);

  const applySelection = useCallback((ids: string[]) => {
    const next = normalizeSelectionIds(ids);
    setSelectedIds(next);
    if (typeof window !== "undefined") {
      if (next.length > 0) {
        window.sessionStorage.setItem(LIBRARY_SELECTION_STORAGE_KEY, JSON.stringify(next));
      } else {
        window.sessionStorage.removeItem(LIBRARY_SELECTION_STORAGE_KEY);
      }
    }
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
        const filteredSet = new Set(filteredIds);
        applySelection(selectedIds.filter((id) => !filteredSet.has(id)));
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
              ? `${loaded.warnings.length} context warning(s) found.`
              : "Prompt and context restored successfully.",
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
        applySelection(selectedIds.filter((value) => value !== id));
        toast({ title: "Saved prompt deleted" });
      } catch (error) {
        toast({
          title: "Failed to delete prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [applySelection, deleteSavedTemplate, selectedIds, toast],
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
          description: "Load this prompt, add a use case context, then try sharing again.",
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
          title: "Prompt shared to community remix feed",
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

  const handleLoadFirstSelected = useCallback(() => {
    const first = selectedPrompts[0];
    if (!first) return;
    void handleSelectSaved(first.id);
  }, [handleSelectSaved, selectedPrompts]);

  const handleBulkSetPrivate = useCallback(async () => {
    if (selectedIds.length === 0 || isBulkUnsharing) return;
    setIsBulkUnsharing(true);
    try {
      const updatedIds = await unshareSavedPrompts(selectedIds);
      if (updatedIds.length === 0) {
        toast({ title: "No shared prompts selected" });
      } else if (updatedIds.length === selectedIds.length) {
        toast({
          title:
            updatedIds.length === 1 ? "1 prompt set to private" : `${updatedIds.length} prompts set to private`,
        });
      } else {
        const unchangedCount = selectedIds.length - updatedIds.length;
        toast({
          title: `${updatedIds.length} prompts set to private`,
          description:
            unchangedCount === 1
              ? "1 prompt was already private."
              : `${unchangedCount} prompts were already private.`,
        });
      }
    } catch (error) {
      toast({
        title: "Failed to update visibility",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setIsBulkUnsharing(false);
    }
  }, [isBulkUnsharing, selectedIds, toast, unshareSavedPrompts]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0 || isBulkDeleting) return;
    const confirmed = window.confirm(
      selectedIds.length === 1
        ? "Delete 1 selected prompt?"
        : `Delete ${selectedIds.length} selected prompts?`,
    );
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      const deletedIds = await deleteSavedTemplates(selectedIds);
      if (deletedIds.length === 0) {
        toast({ title: "No prompts were deleted", variant: "destructive" });
        return;
      }
      const deletedSet = new Set(deletedIds);
      applySelection(selectedIds.filter((id) => !deletedSet.has(id)));
      if (deletedIds.length === selectedIds.length) {
        toast({
          title: deletedIds.length === 1 ? "Deleted 1 prompt" : `Deleted ${deletedIds.length} prompts`,
        });
      } else {
        const skippedCount = selectedIds.length - deletedIds.length;
        toast({
          title: `Deleted ${deletedIds.length} prompts`,
          description:
            skippedCount === 1 ? "1 prompt could not be deleted." : `${skippedCount} prompts could not be deleted.`,
        });
      }
    } catch (error) {
      toast({
        title: "Failed to delete selected prompts",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  }, [applySelection, deleteSavedTemplates, isBulkDeleting, selectedIds, toast]);

  const resetFilters = useCallback(() => {
    setQuery("");
    setActiveCategory("all");
    setShowSelectedOnly(false);
  }, []);

  const renderPromptCard = useCallback(
    (prompt: persistence.PromptSummary) => {
      const isSelected = selectedSet.has(prompt.id);
      const shareUseCase = resolveShareUseCase(prompt);
      const shareDisabledReason = !isSignedIn
        ? "Sign in to share."
        : !shareUseCase
          ? "Add a use case in Builder before sharing."
          : null;

      return (
        <Card
          key={prompt.id}
          className={`interactive-card p-3 transition-colors ${isSelected ? "border-primary/45 bg-primary/5" : "hover:border-primary/40"
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
                    <h3 className="type-wrap-safe text-sm font-medium text-foreground">{prompt.name}</h3>
                    <Badge type="modern" className="border border-border bg-background text-foreground text-xs">
                      r{prompt.revision}
                    </Badge>
                    {prompt.isShared ? (
                      <Badge type="modern" className="text-xs gap-1">
                        <Share2 className="h-3 w-3" />
                        Shared
                      </Badge>
                    ) : (
                      <Badge type="modern" className="border border-border bg-background text-foreground text-xs gap-1">
                        <Lock className="h-3 w-3" />
                        Private
                      </Badge>
                    )}
                    {!isSelectionMode && prompt.remixedFrom && (
                      <Badge type="modern" className="text-xs gap-1">
                        <GitBranch className="h-3 w-3" />
                        Remixed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{ownerName}</p>
                </div>
              </div>

              {isSelectionMode ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="capitalize">{prompt.category || "general"}</span>
                  <span>•</span>
                  <span>{formatUpdatedAt(prompt.updatedAt)}</span>
                  <span>•</span>
                  <span>{prompt.isShared ? "Shared" : "Private"}</span>
                </div>
              ) : (
                <>
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
                      {prompt.sourceCount} context src / {prompt.databaseCount} db
                    </span>
                  </div>
                  {prompt.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {prompt.tags.slice(0, 5).map((tag) => (
                        <Badge key={`${prompt.id}-${tag}`} type="modern" className="border border-border bg-background text-foreground text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {!isMobile && !isSelectionMode && (
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Button
                  type="button"
                  color="primary"
                  size="sm"
                  className="h-11 px-2.5 text-sm sm:h-9 sm:text-sm"
                  onClick={() => void handleSelectSaved(prompt.id)}
                >
                  Load
                </Button>
                {prompt.isShared && prompt.communityPostId && (
                  <Button
                    color="tertiary"
                    size="sm"
                    className="h-11 px-2.5 text-sm sm:h-9 sm:text-sm"
                    onClick={() => navigate(`/community/${prompt.communityPostId}`)}
                  >
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                {prompt.isShared ? (
                  <Button
                    type="button"
                    color="secondary"
                    size="sm"
                    className="h-11 px-2.5 text-sm sm:h-9 sm:text-sm"
                    onClick={() => void handleUnshareSaved(prompt.id)}
                  >
                    Unshare
                  </Button>
                ) : (
                  <Button
                    type="button"
                    color="secondary"
                    size="sm"
                    className="h-11 px-2.5 text-sm sm:h-9 sm:text-sm"
                    isDisabled={Boolean(shareDisabledReason)}
                    onClick={() => void handleShareSaved(prompt)}
                  >
                    Share
                  </Button>
                )}
                {shareDisabledReason && !prompt.isShared && (
                  <p className="max-w-40 text-right text-xs text-muted-foreground">
                    {shareDisabledReason}
                  </p>
                )}
                <Button
                  type="button"
                  color="tertiary"
                  size="sm"
                  className="h-11 px-2.5 text-sm text-destructive hover:text-destructive sm:h-9 sm:text-sm"
                  onClick={() => void handleDeleteSaved(prompt.id)}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>

          {isMobile && !isSelectionMode && (
            <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/60 pt-2">
              {shareDisabledReason && !prompt.isShared && (
                <p className="mr-auto text-xs text-muted-foreground">{shareDisabledReason}</p>
              )}
              <Button
                type="button"
                color="primary"
                size="sm"
                className="h-11 px-3 text-sm"
                onClick={() => void handleSelectSaved(prompt.id)}
              >
                Load
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    color="secondary"
                    size="sm"
                    className="h-11 px-3 text-sm"
                    aria-label={`More actions for ${prompt.name}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {prompt.isShared && prompt.communityPostId && (
                    <DropdownMenuItem
                      onSelect={() => navigate(`/community/${prompt.communityPostId}`)}
                    >
                      Open
                    </DropdownMenuItem>
                  )}
                  {prompt.isShared ? (
                    <DropdownMenuItem onSelect={() => void handleUnshareSaved(prompt.id)}>
                      Unshare
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={Boolean(shareDisabledReason)}
                      onSelect={() => void handleShareSaved(prompt)}
                    >
                      Share
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => void handleDeleteSaved(prompt.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </Card>
      );
    },
    [
      handleDeleteSaved,
      handleSelectSaved,
      handleShareSaved,
      handleUnshareSaved,
      isMobile,
      isSignedIn,
      isSelectionMode,
      navigate,
      ownerAvatarUrl,
      ownerName,
      selectedSet,
      togglePromptSelection,
    ],
  );

  return (
    <PageShell>
      <PageHero
        eyebrow={brandCopy.brandLine}
        title="Prompt Library"
        subtitle="Track quality, context sources, and remix history for every saved prompt."
        className="pf-gilded-frame pf-hero-surface"
      />

      {featuredPrompts.length > 0 && (
        <Card className="pf-panel mb-4 border-[rgba(214,166,64,.32)] p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="pf-text-display text-xl text-[rgba(230,225,213,.95)]">Featured Artifacts</p>
              <p className="text-sm text-[rgba(230,225,213,.72)]">
                Latest prompt builds mapped to Fantasy Forge rarity frames.
              </p>
            </div>
            <Button
              color="secondary"
              size="sm"
              className="h-11 text-sm sm:h-9 sm:text-sm"
              onClick={() => navigate("/")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Forge new prompt
            </Button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {featuredPrompts.map((prompt) => (
              <PFTemplateCard
                key={`featured-${prompt.id}`}
                title={`✦ ${prompt.name}`}
                description={prompt.description || prompt.starterPrompt}
                rarity={getLibraryPromptRarity(prompt)}
                author={prompt.isShared ? "Community Artifact" : ownerName}
                tags={prompt.tags}
                footerLeft={formatUpdatedAt(prompt.updatedAt)}
                footerRight={`r${prompt.revision}`}
                onClick={() => {
                  void handleSelectSaved(prompt.id);
                }}
              />
            ))}
          </div>
        </Card>
      )}

      <div className="ui-density space-y-4" data-density="comfortable">
        <Card className="border-border/80 bg-card/85 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="ui-section-label text-primary">Quality + context + remix</p>
              <p className="text-sm text-muted-foreground">
                Keep your saved prompts production-ready without changing baseline templates.
              </p>
            </div>
            <Button color="secondary" size="sm" className="h-11 gap-1 text-sm sm:h-9 sm:text-sm" onClick={() => navigate("/")}>
              <Sparkles className="h-3.5 w-3.5" />
              Open Builder
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
                onChange={setQuery}
                placeholder="Search by name, tag, context, or remix note"
                wrapperClassName="h-11 bg-background sm:h-10"
                inputClassName="pl-8"
              />
            </div>

            <Select
              selectedKey={activeCategory}
              onSelectionChange={(value) => {
                if (value !== null) {
                  setActiveCategory(String(value));
                }
              }}
              className="min-w-35 capitalize"
              aria-label="Filter category"
              size="md"
            >
              {categories.map((category) => (
                <Select.Item key={category} id={category} className="capitalize">
                  {category}
                </Select.Item>
              ))}
            </Select>

            <div className="flex items-center gap-1.5">
              <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                selectedKey={sortBy}
                onSelectionChange={(value) => {
                  if (value !== null) {
                    setSortBy(String(value) as SavedPromptSort);
                  }
                }}
                className="min-w-34.5"
                aria-label="Sort saved prompts"
                size="md"
              >
                <Select.Item id="recent">Most Recent</Select.Item>
                <Select.Item id="name">Name (A-Z)</Select.Item>
                <Select.Item id="revision">Revision (High)</Select.Item>
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
                  <span>{selectedCount} selected</span>
                  <Badge type="modern" className="text-xs">
                    {visibleSaved.length} shown
                  </Badge>
                  {showSelectedOnly && (
                    <Badge type="modern" className="border border-border bg-background text-foreground text-xs">
                      Selected only
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    color="secondary"
                    size="sm"
                    className="h-11 text-sm sm:h-9 sm:text-sm"
                    isDisabled={selectedCount === 0 && !showSelectedOnly}
                    onClick={() => setShowSelectedOnly((prev) => !prev)}
                  >
                    Selected only
                  </Button>
                  {selectedCount > 0 && (
                    <>
                      <Button
                        type="button"
                        color="primary"
                        size="sm"
                        className="h-11 text-sm sm:h-9 sm:text-sm"
                        onClick={handleLoadFirstSelected}
                      >
                        Load first
                      </Button>
                      <Button
                        type="button"
                        color="secondary"
                        size="sm"
                        className="h-11 text-sm sm:h-9 sm:text-sm"
                        isDisabled={isBulkUnsharing}
                        onClick={() => void handleBulkSetPrivate()}
                      >
                        {isBulkUnsharing ? "Setting private..." : "Set private"}
                      </Button>
                      <Button
                        type="button"
                        color="secondary"
                        size="sm"
                        className="h-11 border-destructive/40 text-sm text-destructive hover:text-destructive sm:h-9 sm:text-sm"
                        isDisabled={isBulkDeleting}
                        onClick={() => void handleBulkDelete()}
                      >
                        {isBulkDeleting ? "Deleting..." : "Delete selected"}
                      </Button>
                      <Button
                        type="button"
                        color="tertiary"
                        size="sm"
                        className="h-11 text-sm sm:h-9 sm:text-sm"
                        onClick={() => {
                          applySelection([]);
                          setShowSelectedOnly(false);
                        }}
                      >
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {templateSummaries.length === 0 && (
              <StateCard
                variant="empty"
                title="No saved prompts yet"
                description="Create a prompt in Builder, run a quality pass, and save it here."
                primaryAction={{ label: "Go to Builder", to: "/" }}
              />
            )}

            {templateSummaries.length > 0 && visibleSaved.length === 0 && (
              <StateCard
                variant="empty"
                title={showSelectedOnly ? "No selected prompts in this view." : "No prompts match this filter."}
                description={
                  showSelectedOnly
                    ? "Select prompts, or switch off Selected only to browse everything."
                    : "Try a different search term, category, or context keyword."
                }
                primaryAction={
                  hasActiveFilters
                    ? { label: "Reset filters", onClick: resetFilters }
                    : { label: "Go to Builder", to: "/" }
                }
                secondaryAction={{ label: "Go to Builder", to: "/" }}
              />
            )}

            {shouldVirtualize ? (
              <div
                ref={listScrollRef}
                className="max-h-[72vh] overflow-y-auto pr-1"
                data-testid="library-virtualized-list"
              >
                <div
                  className="relative w-full"
                  style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const prompt = visibleSaved[virtualItem.index];
                    if (!prompt) return null;

                    return (
                      <div
                        key={prompt.id}
                        data-index={virtualItem.index}
                        ref={rowVirtualizer.measureElement}
                        className="absolute left-0 top-0 w-full pb-2"
                        style={{ transform: `translateY(${virtualItem.start}px)` }}
                      >
                        {renderPromptCard(prompt)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleSaved.map((prompt) => renderPromptCard(prompt))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
};

export default Library;
