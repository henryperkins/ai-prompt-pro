import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Trash2 } from "lucide-react";
import { PageHero, PageShell } from "@/components/PageShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useToast } from "@/hooks/use-toast";
import {
  decodeSelectionIds,
  encodeSelectionIds,
  getInitials,
  getUserAvatarUrl,
  getUserDisplayName,
} from "@/lib/library-pages";

function formatUpdatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const LibraryBulkEdit = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const ownerName = getUserDisplayName(user);
  const ownerAvatarUrl = getUserAvatarUrl(user);
  const { templateSummaries, deleteSavedTemplate, unshareSavedPrompt } = usePromptBuilder();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);

  const queryIds = useMemo(() => decodeSelectionIds(searchParams), [searchParams]);

  useEffect(() => {
    setSelectedIds(queryIds);
  }, [queryIds]);

  const promptById = useMemo(() => new Map(templateSummaries.map((prompt) => [prompt.id, prompt])), [templateSummaries]);
  const selectedPrompts = useMemo(
    () => selectedIds.map((id) => promptById.get(id)).filter(Boolean),
    [promptById, selectedIds],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const applySelection = useCallback(
    (ids: string[]) => {
      const next = Array.from(new Set(ids));
      setSelectedIds(next);
      setSearchParams(encodeSelectionIds(next), { replace: true });
    },
    [setSearchParams],
  );

  const toggleSelection = useCallback(
    (id: string, checked: boolean) => {
      applySelection(checked ? [...selectedIds, id] : selectedIds.filter((value) => value !== id));
    },
    [applySelection, selectedIds],
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0 || isDeleting) return;
    const confirmed = window.confirm(
      selectedIds.length === 1
        ? "Delete 1 selected prompt?"
        : `Delete ${selectedIds.length} selected prompts?`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    const deletedIds: string[] = [];
    try {
      for (const id of selectedIds) {
        const deleted = await deleteSavedTemplate(id);
        if (deleted) deletedIds.push(id);
      }
      if (deletedIds.length > 0) {
        applySelection(selectedIds.filter((id) => !deletedIds.includes(id)));
        toast({
          title: deletedIds.length === 1 ? "Deleted 1 prompt" : `Deleted ${deletedIds.length} prompts`,
        });
      } else {
        toast({ title: "No prompts were deleted", variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "Failed to delete selected prompts",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [applySelection, deleteSavedTemplate, isDeleting, selectedIds, toast]);

  const handleSetPrivate = useCallback(async () => {
    if (selectedIds.length === 0 || isUnsharing) return;
    setIsUnsharing(true);
    let updated = 0;
    try {
      for (const prompt of selectedPrompts) {
        if (!prompt || !prompt.isShared) continue;
        const ok = await unshareSavedPrompt(prompt.id);
        if (ok) updated += 1;
      }
      if (updated > 0) {
        toast({
          title: updated === 1 ? "1 prompt set to private" : `${updated} prompts set to private`,
        });
      } else {
        toast({ title: "No shared prompts selected" });
      }
    } catch (error) {
      toast({
        title: "Failed to update visibility",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setIsUnsharing(false);
    }
  }, [isUnsharing, selectedIds.length, selectedPrompts, toast, unshareSavedPrompt]);

  const handleLoadFirstSelected = useCallback(() => {
    const first = selectedPrompts[0];
    if (!first) return;
    navigate("/library");
    toast({
      title: "Back to library",
      description: `Use Load on “${first.name}” to open it in Builder.`,
    });
  }, [navigate, selectedPrompts, toast]);

  return (
    <PageShell>
      <PageHero
        title="Bulk edit prompts"
        subtitle="Run bulk actions on selected prompts. Presets stay unchanged."
      />

      <div className="space-y-4">
        <Card className="border-border/80 bg-card/85 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="type-label-caps text-xs font-semibold text-primary">Selection</p>
              <p className="text-sm text-muted-foreground">
                {selectedPrompts.length > 0
                  ? `${selectedPrompts.length} prompt(s) selected from Library`
                  : "No selected prompts in this bulk edit session"}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-11 gap-1 text-sm sm:h-9 sm:text-base">
              <Link to="/library">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Library
              </Link>
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="border-border/80 bg-card/85 p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-foreground">Batch Actions</h2>
            <div className="mt-2 space-y-2 text-xs text-muted-foreground">
              <p>These actions apply to all checked prompts.</p>
              <p className="rounded-md border border-border/70 bg-background/60 px-2 py-1">
                Presets/templates remain unchanged. Only saved library prompts are modified.
              </p>
            </div>

            <div className="mt-3 space-y-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-11 w-full justify-start gap-1.5 text-sm sm:h-9 sm:text-base"
                disabled={selectedPrompts.length === 0}
                onClick={handleLoadFirstSelected}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Review first selected in Library
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 w-full justify-start gap-1.5 text-sm sm:h-9 sm:text-base"
                disabled={selectedPrompts.length === 0 || isUnsharing}
                onClick={() => void handleSetPrivate()}
              >
                <Lock className="h-3.5 w-3.5" />
                {isUnsharing ? "Setting private..." : "Set selected to private"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 w-full justify-start gap-1.5 border-destructive/40 text-sm text-destructive hover:text-destructive sm:h-9 sm:text-base"
                disabled={selectedPrompts.length === 0 || isDeleting}
                onClick={() => void handleDeleteSelected()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? "Deleting..." : "Delete selected"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 w-full justify-start gap-1.5 text-sm sm:h-9 sm:text-base"
                disabled={selectedPrompts.length === 0}
                onClick={() => applySelection([])}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Clear selection
              </Button>
            </div>
          </Card>

          <Card className="border-border/80 bg-card/85 p-3 sm:p-4">
            {templateSummaries.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-3 text-sm text-muted-foreground">
                No saved prompts found. Save prompts from Builder first.
              </div>
            ) : (
              <div className="space-y-2">
                {templateSummaries.map((prompt) => {
                  const checked = selectedSet.has(prompt.id);
                  return (
                    <div
                      key={prompt.id}
                      className={`rounded-md border p-3 transition-colors ${
                        checked ? "border-primary/45 bg-primary/5" : "border-border/70 bg-background/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleSelection(prompt.id, value === true)}
                          aria-label={`Select ${prompt.name}`}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar className="h-7 w-7 border border-border/60">
                              <AvatarImage src={ownerAvatarUrl ?? undefined} alt={ownerName} />
                              <AvatarFallback className="text-xs">{getInitials(ownerName)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{prompt.name}</p>
                              <p className="text-xs text-muted-foreground">{ownerName}</p>
                            </div>
                            <Badge variant="outline" className="ml-auto text-xs">
                              r{prompt.revision}
                            </Badge>
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
                            <span>{prompt.isShared ? "Shared" : "Private"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
};

export default LibraryBulkEdit;
