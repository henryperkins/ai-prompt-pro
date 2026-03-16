import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Card } from "@/components/base/card";
import { Checkbox } from "@/components/base/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/dialog";
import { Input } from "@/components/base/input/input";
import { ScrollArea } from "@/components/base/scroll-area";
import { Select } from "@/components/base/select/select";
import { useGithubSourcePicker } from "@/hooks/useGithubSourcePicker";
import type { ContextSource } from "@/lib/context-types";
import { cx } from "@/lib/utils/cx";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  CheckCircle,
  FileCode,
  Folder,
  GitBranch,
  GithubLogo,
  LinkBreak,
  MagnifyingGlass,
  Plug,
  SpinnerGap as Loader2,
  WarningCircle,
} from "@phosphor-icons/react";

export interface GitHubSetupState {
  status: "success" | "error";
  message?: string | null;
  nonce: number;
}

interface GitHubSourcePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSourceCount: number;
  onAttachSources: (sources: ContextSource[]) => void;
  setupState?: GitHubSetupState | null;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function SetupNotice({ setupState }: { setupState: GitHubSetupState }) {
  const isSuccess = setupState.status === "success";
  return (
    <div
      className={cx(
        "rounded-lg border px-3 py-2.5 text-sm",
        isSuccess
          ? "border-primary/25 bg-primary/5 text-foreground"
          : "border-destructive/30 bg-destructive/10 text-foreground",
      )}
    >
      <div className="flex items-start gap-2">
        {isSuccess ? (
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : (
          <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">
            {isSuccess ? "GitHub connected" : "GitHub setup failed"}
          </p>
          <p className="text-muted-foreground">
            {setupState.message?.trim() ||
              (isSuccess
                ? "Choose an installation and attach repository files as context."
                : "Retry the installation flow, then return here.")}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GitHubSourcePickerDialog({
  open,
  onOpenChange,
  existingSourceCount,
  onAttachSources,
  setupState,
}: GitHubSourcePickerDialogProps) {
  const picker = useGithubSourcePicker({
    open,
    existingSourceCount,
    onAttachSources,
    refreshKey: setupState?.status === "success" ? setupState.nonce : undefined,
  });

  const selectedInstallationLabel = picker.installations.find(
    (installation) =>
      installation.githubInstallationId === picker.selectedInstallationId,
  )?.githubAccountLogin;

  const repoActionLabel = !picker.selectedRepository
    ? "Select a repository"
    : picker.selectedRepository.connected
      ? picker.selectedConnection?.id === picker.selectedRepository.connectionId
        ? "Using connected repo"
        : "Use connected repo"
      : "Connect selected repo";

  const repoActionDisabled =
    !picker.selectedRepository ||
    picker.isConnectingRepository ||
    (picker.selectedRepository.connected &&
      picker.selectedConnection?.id === picker.selectedRepository.connectionId);

  const selectedFileCount = picker.selectedPaths.length;
  const footerSummary = picker.selectedConnection
    ? selectedFileCount > 0
      ? `${selectedFileCount} file${selectedFileCount === 1 ? "" : "s"} selected from ${picker.selectedConnection.fullName}.`
      : `Choose files from ${picker.selectedConnection.fullName} to attach as context.`
    : "Connect a repository to search and attach files.";

  const handleAttach = async () => {
    const success = await picker.attachSelectedFiles();
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GithubLogo className="h-5 w-5 text-foreground" />
            Add from GitHub
          </DialogTitle>
          <DialogDescription>
            Connect a repository, search files, preview content, and attach the selected files to the builder context.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[78vh] space-y-4 overflow-y-auto pr-1">
          {setupState ? <SetupNotice setupState={setupState} /> : null}

          {picker.errorMessage ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {picker.errorMessage}
            </div>
          ) : null}

          {picker.authLoading ? (
            <Card className="flex items-center gap-2 border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking your session.
            </Card>
          ) : !picker.isSignedIn ? (
            <Card className="space-y-2 border-border/70 bg-card/80 p-4">
              <div className="flex items-start gap-2">
                <LinkBreak className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Sign in required
                  </p>
                  <p className="text-sm text-muted-foreground">
                    GitHub context uses your PromptForge user session only. Sign in, then reopen this picker.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <Card className="space-y-3 border-border/70 bg-card/80 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Installations
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Install the PromptForge GitHub app, then pick the account that owns the repository.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      className="h-11 gap-1.5 text-sm sm:h-10"
                      onClick={() => void picker.startInstall()}
                      loading={picker.isStartingInstall}
                      showTextWhileLoading
                      iconLeading={ArrowSquareOut}
                    >
                      {picker.installations.length > 0
                        ? "Install another account"
                        : "Install GitHub app"}
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-11 gap-1.5 text-sm sm:h-10"
                      onClick={() => void picker.refreshData()}
                      loading={picker.isBootstrapping}
                      showTextWhileLoading
                      iconLeading={ArrowsClockwise}
                    >
                      Refresh
                    </Button>
                  </div>

                  {picker.installations.length > 0 ? (
                    <Select
                      selectedKey={
                        picker.selectedInstallationId
                          ? String(picker.selectedInstallationId)
                          : undefined
                      }
                      onSelectionChange={(value) => {
                        const nextId = Number(value);
                        if (Number.isFinite(nextId)) {
                          picker.selectInstallation(nextId);
                        }
                      }}
                      placeholder="Choose an installation"
                      aria-label="Choose GitHub installation"
                    >
                      {picker.installations.map((installation) => (
                        <Select.Item
                          key={installation.githubInstallationId}
                          id={String(installation.githubInstallationId)}
                        >
                          {installation.githubAccountLogin}
                        </Select.Item>
                      ))}
                    </Select>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                      No GitHub installations yet.
                    </div>
                  )}

                  {selectedInstallationLabel ? (
                    <p className="text-xs text-muted-foreground">
                      Active installation: <span className="font-medium text-foreground">{selectedInstallationLabel}</span>
                    </p>
                  ) : null}
                </Card>

                {picker.connections.length > 0 ? (
                  <Card className="space-y-3 border-border/70 bg-card/80 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Connected repos
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Jump back into a repository you already connected.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {picker.connections.slice(0, 8).map((connection) => {
                        const isActive = picker.selectedConnection?.id === connection.id;
                        return (
                          <Button
                            key={connection.id}
                            variant={isActive ? "primary" : "secondary"}
                            className="h-10 text-sm"
                            onClick={() => picker.activateConnection(connection)}
                          >
                            {connection.fullName}
                          </Button>
                        );
                      })}
                    </div>
                  </Card>
                ) : null}

                <Card className="space-y-3 border-border/70 bg-card/80 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Repositories
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Search repositories inside the selected installation, then connect the one you want to use.
                    </p>
                  </div>

                  <Input
                    value={picker.repoQuery}
                    onChange={picker.setRepoQuery}
                    placeholder="Search owner/repo"
                    aria-label="Search repositories"
                    icon={MagnifyingGlass}
                  />

                  <div className="rounded-lg border border-border/70 bg-background/60">
                    <ScrollArea className="h-64">
                      <div className="space-y-2 p-2">
                        {picker.isRepositoriesLoading ? (
                          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading repositories.
                          </div>
                        ) : picker.repositories.length > 0 ? (
                          picker.repositories.map((repository) => {
                            const isSelected =
                              picker.selectedRepository?.fullName === repository.fullName;
                            return (
                              <button
                                key={repository.id}
                                type="button"
                                className={cx(
                                  "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                                  isSelected
                                    ? "border-primary/35 bg-primary/5"
                                    : "border-border/70 bg-card/80 hover:border-primary/30",
                                )}
                                onClick={() => picker.selectRepository(repository)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">
                                      {repository.fullName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Default branch: {repository.defaultBranch || "default"}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 flex-wrap gap-1">
                                    <Badge variant="modern" className="text-xs">
                                      {repository.visibility}
                                    </Badge>
                                    {repository.connected ? (
                                      <Badge variant="modern" className="text-xs">
                                        Connected
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-2 py-3 text-sm text-muted-foreground">
                            {picker.selectedInstallationId
                              ? "No repositories matched this installation query."
                              : "Choose an installation to load repositories."}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {picker.repoNextCursor ? (
                    <Button
                      variant="secondary"
                      className="h-10 w-full text-sm"
                      onClick={() => void picker.loadMoreRepositories()}
                      loading={picker.isLoadingMoreRepositories}
                      showTextWhileLoading
                    >
                      Load more repositories
                    </Button>
                  ) : null}

                  <Button
                    variant="secondary"
                    className="h-11 w-full gap-1.5 text-sm sm:h-10"
                    disabled={repoActionDisabled}
                    onClick={() => void picker.activateSelectedRepository()}
                    loading={picker.isConnectingRepository}
                    showTextWhileLoading
                    iconLeading={Plug}
                  >
                    {repoActionLabel}
                  </Button>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="space-y-3 border-border/70 bg-card/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        {picker.selectedConnection
                          ? picker.selectedConnection.fullName
                          : "Repository files"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {picker.selectedConnection
                          ? "Search and select the files that should be attached as context."
                          : "Connect a repository to search its file index."}
                      </p>
                    </div>
                    {picker.selectedConnection ? (
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="modern" className="text-xs">
                          {picker.selectedConnection.visibility}
                        </Badge>
                        <Badge variant="modern" className="text-xs">
                          {picker.selectedConnection.defaultBranch || "default"}
                        </Badge>
                      </div>
                    ) : null}
                  </div>

                  <Input
                    value={picker.fileQuery}
                    onChange={picker.setFileQuery}
                    placeholder="Search files by path or filename"
                    aria-label="Search repository files"
                    icon={MagnifyingGlass}
                    isDisabled={!picker.selectedConnection}
                  />

                  {picker.fileSearchStaleFallback ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                      Showing cached file results because the latest manifest refresh fell back to the last successful snapshot.
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-border/70 bg-background/60">
                    <ScrollArea className="h-72">
                      <div className="space-y-2 p-2">
                        {picker.isFilesLoading ? (
                          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading files.
                          </div>
                        ) : picker.selectedConnection ? (
                          picker.fileResults.length > 0 ? (
                            picker.fileResults.map((entry) => {
                              const isSelected = picker.selectedPaths.includes(entry.path);
                              const isPreviewed = picker.previewedFile?.path === entry.path;
                              return (
                                <div
                                  key={entry.path}
                                  className={cx(
                                    "rounded-lg border px-3 py-2 transition-colors",
                                    isPreviewed
                                      ? "border-primary/35 bg-primary/5"
                                      : "border-border/70 bg-card/80",
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      isSelected={isSelected}
                                      onChange={() => picker.toggleSelectedPath(entry.path)}
                                      aria-label={`Select ${entry.path}`}
                                      className="mt-0.5"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p
                                        className="truncate text-sm font-medium text-foreground"
                                        title={entry.path}
                                      >
                                        {entry.path}
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {entry.language ? (
                                          <Badge variant="modern" className="text-xs">
                                            {entry.language}
                                          </Badge>
                                        ) : null}
                                        <Badge variant="modern" className="text-xs">
                                          {formatBytes(entry.size)}
                                        </Badge>
                                      </div>
                                    </div>
                                    <Button
                                      variant={isPreviewed ? "primary" : "secondary"}
                                      className="h-9 shrink-0 text-sm"
                                      onClick={() => void picker.previewFile(entry.path)}
                                    >
                                      Preview
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-2 py-3 text-sm text-muted-foreground">
                              No files matched this search.
                            </div>
                          )
                        ) : (
                          <div className="px-2 py-3 text-sm text-muted-foreground">
                            Connect a repository to browse files.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {picker.selectedPaths.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {picker.selectedPaths.map((path) => (
                        <Badge key={path} variant="modern" className="max-w-full text-xs">
                          <span className="truncate" title={path}>
                            {path}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </Card>

                <Card className="space-y-3 border-border/70 bg-card/80 p-4">
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      File preview
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Preview the selected file before attaching it to the builder.
                    </p>
                  </div>

                  {picker.isPreviewLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading preview.
                    </div>
                  ) : picker.previewedFile ? (
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p
                            className="truncate text-sm font-medium text-foreground"
                            title={picker.previewedFile.path}
                          >
                            {picker.previewedFile.path}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {picker.previewedFile.locator}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {picker.previewedFile.language ? (
                            <Badge variant="modern" className="text-xs">
                              {picker.previewedFile.language}
                            </Badge>
                          ) : null}
                          <Badge variant="modern" className="text-xs">
                            {formatBytes(picker.previewedFile.size)}
                          </Badge>
                          {picker.previewedFile.truncated ? (
                            <Badge variant="modern" className="text-xs">
                              Truncated
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <pre className="max-h-80 overflow-auto rounded-lg border border-border/70 bg-background/60 p-3 text-xs text-foreground">
                        <code>{picker.previewedFile.content}</code>
                      </pre>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-sm text-muted-foreground">
                      Preview a file to inspect its content here.
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>

        {picker.isSignedIn && !picker.authLoading ? (
          <DialogFooter className="mt-4 gap-3 border-t border-border pt-4">
            <div className="mr-auto space-y-1 text-left text-sm text-muted-foreground">
              <p>{footerSummary}</p>
              <p>
                {picker.remainingAttachmentSlots} source slot
                {picker.remainingAttachmentSlots === 1 ? "" : "s"} remaining before this attach.
              </p>
              {picker.attachDisabledReason ? (
                <p className="text-destructive">{picker.attachDisabledReason}</p>
              ) : null}
            </div>
            <Button
              variant="secondary"
              className="h-11 text-sm sm:h-10"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              className="h-11 gap-1.5 text-sm sm:h-10"
              disabled={!picker.canAttach}
              loading={picker.isAttaching}
              showTextWhileLoading
              iconLeading={Folder}
              onClick={() => void handleAttach()}
            >
              Attach selected files
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
