import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ScrollArea } from "@/components/base/scroll-area";
import { cx } from "@/lib/utils/cx";
import type { GitHubManifestSearchResult } from "@/lib/github-client";
import {
  Eye,
  FileText,
  SpinnerGap,
} from "@phosphor-icons/react";

interface GitHubSearchResultsProps {
  activePreviewPath: string | null;
  emptyMessage: string;
  loading: boolean;
  onPreview: (path: string) => void;
  onToggleSelect: (path: string) => void;
  previewLoading: boolean;
  results: GitHubManifestSearchResult[];
  selectedPaths: string[];
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function GitHubSearchResults({
  activePreviewPath,
  emptyMessage,
  loading,
  onPreview,
  onToggleSelect,
  previewLoading,
  results,
  selectedPaths,
}: GitHubSearchResultsProps) {
  if (loading) {
    return (
      <div className="flex min-h-28 items-center justify-center rounded-lg border border-border/80 bg-background/60">
        <SpinnerGap className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 bg-background/40 p-4 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-72 rounded-lg border border-border/80 bg-background/60">
      <div className="space-y-2 p-2">
        {results.map((result) => {
          const selected = selectedPaths.includes(result.path);
          const previewActive = activePreviewPath === result.path;
          return (
            <div
              key={result.path}
              className={cx(
                "rounded-lg border p-3 transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border/70 hover:border-primary/30 hover:bg-muted/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {result.path}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="modern" className="text-[11px]">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {result.language || result.extension || "File"}
                      </span>
                    </Badge>
                    <Badge variant="pill" color="gray">
                      {formatFileSize(result.size)}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="tertiary"
                    className="h-9 gap-1 text-xs"
                    onClick={() => onPreview(result.path)}
                  >
                    {previewLoading && previewActive ? (
                      <SpinnerGap className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "primary" : "secondary"}
                    className="h-9 text-xs"
                    onClick={() => onToggleSelect(result.path)}
                  >
                    {selected ? "Selected" : "Select"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
