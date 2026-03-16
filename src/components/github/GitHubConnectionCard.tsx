import { Badge } from "@/components/base/badges/badges";
import { cx } from "@/lib/utils/cx";
import type { GitHubRepository } from "@/lib/github-client";
import {
  CheckCircle,
  Globe,
  GitBranch,
  LockSimple,
  SpinnerGap,
} from "@phosphor-icons/react";

interface GitHubConnectionCardProps {
  repository: GitHubRepository;
  isSelected: boolean;
  isBusy: boolean;
  onSelect: (repository: GitHubRepository) => void;
}

export function GitHubConnectionCard({
  repository,
  isSelected,
  isBusy,
  onSelect,
}: GitHubConnectionCardProps) {
  return (
    <button
      type="button"
      className={cx(
        "w-full rounded-lg border p-3 text-left transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border/80 bg-background hover:border-primary/40 hover:bg-muted/30",
      )}
      onClick={() => onSelect(repository)}
      disabled={isBusy}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {repository.fullName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Default branch: {repository.defaultBranch || "default"}
          </p>
        </div>
        <div className="shrink-0">
          {isBusy ? (
            <SpinnerGap className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : repository.connected ? (
            <CheckCircle className="h-4 w-4 text-primary" />
          ) : (
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="modern" className="text-[11px]">
          {repository.connected ? "Connected" : "Available"}
        </Badge>
        <Badge variant="pill" color={repository.isPrivate ? "warning" : "gray"}>
          <span className="inline-flex items-center gap-1">
            {repository.isPrivate ? (
              <LockSimple className="h-3 w-3" />
            ) : (
              <Globe className="h-3 w-3" />
            )}
            {repository.isPrivate ? "Private" : "Public"}
          </span>
        </Badge>
      </div>
    </button>
  );
}
