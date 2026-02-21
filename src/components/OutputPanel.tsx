import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card } from "@/components/base/primitives/card";
import { Button } from "@/components/base/primitives/button";
import { Copy, Check, Sparkles, Save, Loader2, MoreHorizontal, Globe } from "lucide-react";
import { Input } from "@/components/base/primitives/input";
import { Label } from "@/components/base/primitives/label";
import { Textarea } from "@/components/base/primitives/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/primitives/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/base/primitives/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/base/primitives/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  validateSaveDialogInput,
} from "@/lib/output-panel-validation";
import { trackBuilderEvent } from "@/lib/telemetry";
import { buildLineDiff, type DiffLine } from "@/lib/text-diff";
import { cn } from "@/lib/utils";
import { normalizeHttpUrl } from "@/lib/url-utils";
import { Checkbox } from "@/components/base/primitives/checkbox";
import { Switch } from "@/components/base/primitives/switch";

export type EnhancePhase = "idle" | "starting" | "streaming" | "settling" | "done";
const REASONING_SUMMARY_FADE_MS = 900;

interface SavePromptInput {
  name: string;
  description?: string;
  tags?: string[];
  category?: string;
  remixNote?: string;
}

interface SaveAndSharePromptInput extends SavePromptInput {
  useCase: string;
  targetModel?: string;
}

interface OutputPanelProps {
  builtPrompt: string;
  enhancedPrompt: string;
  isEnhancing: boolean;
  onEnhance: () => void;
  onSaveVersion: () => void;
  onSavePrompt: (input: SavePromptInput) => void;
  onSaveAndSharePrompt: (input: SaveAndSharePromptInput) => void;
  canSavePrompt: boolean;
  canSharePrompt: boolean;
  hideEnhanceButton?: boolean;
  enhancePhase?: EnhancePhase;
  enhanceIdleLabel?: string;
  phase2Enabled?: boolean;
  remixContext?: { title: string; authorName: string };
  webSearchEnabled?: boolean;
  onWebSearchToggle?: (enabled: boolean) => void;
  webSearchSources?: string[];
  reasoningSummary?: string;
}

type CodexExportModule = typeof import("@/lib/codex-export");

async function loadCodexExport(): Promise<CodexExportModule> {
  return import("@/lib/codex-export");
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

function parseWebSourceLink(value: string): { title: string; href: string } | null {
  const mdLink = value.match(/^\[(.+?)]\((.+?)\)$/);
  if (!mdLink) return null;

  const normalizedHref = normalizeHttpUrl(mdLink[2]);
  if (!normalizedHref) return null;

  return {
    title: mdLink[1],
    href: normalizedHref,
  };
}

export function OutputPanel({
  builtPrompt,
  enhancedPrompt,
  isEnhancing,
  onEnhance,
  onSaveVersion,
  onSavePrompt,
  onSaveAndSharePrompt,
  canSavePrompt,
  canSharePrompt,
  hideEnhanceButton = false,
  enhancePhase = "idle",
  enhanceIdleLabel = "Enhance with AI",
  phase2Enabled = true,
  remixContext,
  webSearchEnabled = false,
  onWebSearchToggle,
  webSearchSources = [],
  reasoningSummary = "",
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveTags, setSaveTags] = useState("");
  const [saveCategory, setSaveCategory] = useState("general");
  const [saveUseCase, setSaveUseCase] = useState("");
  const [saveTargetModel, setSaveTargetModel] = useState("");
  const [saveConfirmedSafe, setSaveConfirmedSafe] = useState(false);
  const [saveRemixNote, setSaveRemixNote] = useState("");
  const [saveNameTouched, setSaveNameTouched] = useState(false);
  const [saveUseCaseTouched, setSaveUseCaseTouched] = useState(false);
  const [saveConfirmedSafeTouched, setSaveConfirmedSafeTouched] = useState(false);
  const [saveSubmitAttempted, setSaveSubmitAttempted] = useState(false);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const displayPrompt = enhancedPrompt || builtPrompt;
  const trimmedReasoningSummary = reasoningSummary.trim();
  const [displayedReasoningSummary, setDisplayedReasoningSummary] = useState(trimmedReasoningSummary);
  const [isReasoningSummaryFading, setIsReasoningSummaryFading] = useState(false);
  const shareEnabledForUi = shareEnabled && canSharePrompt;

  useEffect(() => {
    if (trimmedReasoningSummary) {
      setDisplayedReasoningSummary(trimmedReasoningSummary);
      setIsReasoningSummaryFading(false);
      return;
    }

    if (!displayedReasoningSummary) {
      setIsReasoningSummaryFading(false);
      return;
    }

    setIsReasoningSummaryFading(true);
    const fadeTimer = window.setTimeout(() => {
      setDisplayedReasoningSummary("");
      setIsReasoningSummaryFading(false);
    }, REASONING_SUMMARY_FADE_MS);

    return () => window.clearTimeout(fadeTimer);
  }, [displayedReasoningSummary, trimmedReasoningSummary]);

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopyCodex = async (variant: "exec" | "tui" | "appServer") => {
    if (!displayPrompt) return;

    try {
      const codexExport = await loadCodexExport();
      const command =
        variant === "exec"
          ? codexExport.generateCodexExecCommandBash(displayPrompt)
          : variant === "tui"
            ? codexExport.generateCodexTuiCommandBash(displayPrompt)
            : codexExport.generateCodexAppServerSendMessageV2CommandBash(displayPrompt);
      await copyTextToClipboard(command);
      toast({
        title: "Copied for Codex",
        description:
          variant === "exec"
            ? "Copied `codex exec` stdin command."
            : variant === "tui"
              ? "Copied `codex` TUI command."
              : "Copied app-server debug command.",
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "copy_codex",
        variant,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "Codex command generation is unavailable.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAgents = async (variant: "agents" | "override") => {
    if (!displayPrompt) return;

    try {
      const codexExport = await loadCodexExport();
      const content =
        variant === "override"
          ? codexExport.generateAgentsOverrideMdFromPrompt(displayPrompt)
          : codexExport.generateAgentsMdFromPrompt(displayPrompt);
      const filename = variant === "override" ? "AGENTS.override.md" : "AGENTS.md";
      downloadTextFile(filename, content);
      toast({
        title: "Downloaded",
        description: `${filename} generated from the current output.`,
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "download_agents",
        variant,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "AGENTS file generation is unavailable.",
        variant: "destructive",
      });
    }
  };

  const handleCopyCodexSkillScaffold = async () => {
    if (!displayPrompt) return;

    try {
      const codexExport = await loadCodexExport();
      const command = codexExport.generateCodexSkillScaffoldCommandBash(displayPrompt, {
        skillName: codexExport.CODEX_DEFAULT_SKILL_NAME,
      });
      await copyTextToClipboard(command);
      toast({
        title: "Copied for Codex",
        description: `Copied command to scaffold .agents/skills/${codexExport.CODEX_DEFAULT_SKILL_NAME}/SKILL.md.`,
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "copy_skill_scaffold",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "Codex scaffold generation is unavailable.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadSkill = async () => {
    if (!displayPrompt) return;

    try {
      const codexExport = await loadCodexExport();
      const content = codexExport.generateSkillMdFromPrompt(displayPrompt, {
        skillName: codexExport.CODEX_DEFAULT_SKILL_NAME,
      });
      downloadTextFile("SKILL.md", content);
      toast({
        title: "Downloaded",
        description: `SKILL.md generated for skill name "${codexExport.CODEX_DEFAULT_SKILL_NAME}".`,
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "download_skill",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "SKILL.md generation is unavailable.",
        variant: "destructive",
      });
    }
  };

  const developerToolItems = (
    <>
      <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleCopyCodex("exec")}>
        Copy Codex exec command
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleCopyCodex("tui")}>
        Copy Codex TUI command
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleCopyCodex("appServer")}>
        Copy app server command
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleCopyCodexSkillScaffold()}>
        Copy skill scaffold
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleDownloadSkill()}>
        Download SKILL.md
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleDownloadAgents("agents")}>
        Download AGENTS.md
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleDownloadAgents("override")}>
        Download AGENTS.override.md
      </DropdownMenuItem>
    </>
  );

  const isStreamingVisual = enhancePhase === "starting" || enhancePhase === "streaming";
  const isSettledVisual = enhancePhase === "settling" || enhancePhase === "done";
  const statusLabel =
    enhancePhase === "starting"
      ? "Starting"
      : enhancePhase === "streaming"
        ? "Streaming"
        : enhancePhase === "settling"
          ? "Finalizing"
          : enhancePhase === "done"
            ? "Ready"
            : null;
  const enhanceLabel = isEnhancing
    ? enhancePhase === "starting"
      ? "Priming..."
      : enhancePhase === "settling"
        ? "Finalizing..."
        : "Enhancing..."
    : enhancePhase === "done"
      ? "Enhanced"
      : enhanceIdleLabel;
  const enhanceAssistiveStatus =
    enhancePhase === "starting"
      ? "Enhancement started."
      : enhancePhase === "streaming"
        ? "Enhancement in progress."
        : enhancePhase === "settling"
          ? "Enhancement finalizing."
          : enhancePhase === "done"
            ? "Enhancement complete."
            : "";
  const hasCompare = Boolean(
    builtPrompt.trim() && enhancedPrompt.trim() && builtPrompt.trim() !== enhancedPrompt.trim()
  );
  const canUseSaveMenu = canSavePrompt || canSharePrompt || Boolean(displayPrompt);
  const saveValidationErrors = validateSaveDialogInput({
    name: saveName,
    shareEnabled: shareEnabledForUi,
    useCase: saveUseCase,
    confirmedSafe: saveConfirmedSafe,
  });
  const saveNameError = saveValidationErrors.name ?? null;
  const showSaveNameError = Boolean(saveNameError && (saveNameTouched || saveSubmitAttempted));
  const saveUseCaseError = saveValidationErrors.useCase ?? null;
  const showSaveUseCaseError = Boolean(saveUseCaseError && (saveUseCaseTouched || saveSubmitAttempted));
  const saveConfirmedSafeError = saveValidationErrors.confirmedSafe ?? null;
  const showSaveConfirmedSafeError = Boolean(
    saveConfirmedSafeError && (saveConfirmedSafeTouched || saveSubmitAttempted),
  );

  const diff = useMemo(() => {
    if (!compareDialogOpen || !hasCompare) return null;
    return buildLineDiff(builtPrompt, enhancedPrompt);
  }, [compareDialogOpen, hasCompare, builtPrompt, enhancedPrompt]);

  const handleCopy = async () => {
    if (!displayPrompt) return;
    try {
      await copyTextToClipboard(displayPrompt);
      setCopied(true);
      toast({ title: "Copied to clipboard!", description: "Paste it into your favorite AI tool." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access is blocked. Copy manually from the preview.",
        variant: "destructive",
      });
    }
  };

  const resetSaveDialogState = () => {
    setSaveName("");
    setSaveDescription("");
    setSaveTags("");
    setSaveCategory("general");
    setSaveUseCase("");
    setSaveTargetModel("");
    setSaveConfirmedSafe(false);
    setSaveRemixNote("");
    setShareEnabled(false);
    setSaveNameTouched(false);
    setSaveUseCaseTouched(false);
    setSaveConfirmedSafeTouched(false);
    setSaveSubmitAttempted(false);
  };

  const handleSaveSubmit = () => {
    setSaveSubmitAttempted(true);

    const canShareNow = shareEnabled && canSharePrompt;
    if (shareEnabled && !canSharePrompt) {
      setShareEnabled(false);
    }

    const effectiveErrors = canShareNow
      ? { nameErr: saveNameError, useCaseErr: saveUseCaseError, safeErr: saveConfirmedSafeError }
      : { nameErr: saveNameError, useCaseErr: null, safeErr: null };
    if (effectiveErrors.nameErr || effectiveErrors.useCaseErr || effectiveErrors.safeErr) {
      setSaveNameTouched(true);
      if (canShareNow) {
        setSaveUseCaseTouched(true);
        setSaveConfirmedSafeTouched(true);
      }
      return;
    }

    if (canShareNow) {
      onSaveAndSharePrompt({
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
        tags: parseTags(saveTags),
        category: saveCategory,
        useCase: saveUseCase.trim(),
        targetModel: saveTargetModel.trim() || undefined,
        remixNote: remixContext ? saveRemixNote.trim() || undefined : undefined,
      });
    } else {
      onSavePrompt({
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
        tags: parseTags(saveTags),
        category: saveCategory,
        remixNote: remixContext ? saveRemixNote.trim() || undefined : undefined,
      });
    }

    setSaveDialogOpen(false);
    resetSaveDialogState();
  };

  const handleSaveDialogOpenChange = (open: boolean) => {
    setSaveDialogOpen(open);
    if (open) return;
    setSaveNameTouched(false);
    setSaveUseCaseTouched(false);
    setSaveConfirmedSafeTouched(false);
    setSaveSubmitAttempted(false);
  };

  const handleShareToggleChange = (enabled: boolean) => {
    if (enabled && !canSharePrompt) return;
    setShareEnabled(enabled);
    trackBuilderEvent("builder_share_toggled", { enabled });
    if (!enabled) {
      setSaveUseCaseTouched(false);
      setSaveConfirmedSafeTouched(false);
    }
  };

  const openSaveDialog = (share: boolean) => {
    if (share && !canSharePrompt) return;
    if (remixContext) {
      if (!saveName.trim()) {
        setSaveName(`Remix of ${remixContext.title}`);
      }
    } else {
      setSaveRemixNote("");
    }
    setShareEnabled(share);
    trackBuilderEvent("builder_save_clicked", { shareEnabled: share });
    setSaveDialogOpen(true);
  };

  return (
    <div className="ui-density space-y-4 h-full flex flex-col" data-density="comfortable">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {enhanceAssistiveStatus}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">
            {enhancedPrompt ? "✨ Enhanced Prompt" : "📝 Preview"}
          </h2>
          {statusLabel && (
            <span className="interactive-chip inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {statusLabel}
            </span>
          )}
          {hasCompare && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ui-toolbar-button px-2"
              onClick={() => setCompareDialogOpen(true)}
            >
              Show changes
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={handleCopy}
            disabled={!displayPrompt}
            className="ui-toolbar-button gap-1.5 font-semibold min-w-[96px] shadow-md"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="brandSecondary" size="sm" disabled={!canUseSaveMenu} className="ui-toolbar-button gap-1.5">
                <Save className="w-3 h-3" />
                Save
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {phase2Enabled ? (
                <DropdownMenuItem
                  disabled={!canSavePrompt}
                  onSelect={() => openSaveDialog(false)}
                >
                  Save Prompt
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    disabled={!canSavePrompt}
                    onSelect={() => openSaveDialog(false)}
                  >
                    Save Prompt
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canSharePrompt}
                    onSelect={() => openSaveDialog(true)}
                  >
                    Save & Share Prompt
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem disabled={!displayPrompt} onSelect={() => onSaveVersion()}>
                Save Version
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="ui-toolbar-button gap-1.5">
                <MoreHorizontal className="w-3 h-3" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isMobile ? (
                <>
                  <DropdownMenuLabel>Developer tools</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {developerToolItems}
                </>
              ) : (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Developer tools</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {developerToolItems}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Before vs After</DialogTitle>
            <DialogDescription>
              {diff
                ? `${diff.added} added, ${diff.removed} removed`
                : "Generate an enhanced prompt to compare changes."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-card overflow-auto flex-1 min-h-[280px]">
            <div className="font-mono text-xs leading-relaxed">
              <div className="px-3 py-1.5 border-b border-border text-muted-foreground">
                --- before
              </div>
              <div className="px-3 py-1.5 border-b border-border text-muted-foreground">
                +++ after
              </div>
              {diff?.lines.map((line, index) => (
                <DiffRow key={`${line.type}-${index}`} line={line} />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={handleSaveDialogOpenChange}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{shareEnabledForUi ? "Save & Share Prompt" : "Save Prompt"}</DialogTitle>
            <DialogDescription>
              {shareEnabledForUi
                ? "Publish this prompt recipe to the community feed."
                : "Save a private prompt snapshot to your library."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {remixContext && (
              <div className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
                Remixing {remixContext.authorName}’s “{remixContext.title}”
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="save-dialog-name" className="text-xs font-medium">
                Prompt title
              </Label>
              <Input
                id="save-dialog-name"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                onBlur={() => setSaveNameTouched(true)}
                placeholder="Prompt title"
                className="bg-background"
                aria-invalid={showSaveNameError}
                aria-describedby="save-dialog-name-help"
              />
              <p
                id="save-dialog-name-help"
                className={cn("text-xs", showSaveNameError ? "text-destructive" : "text-muted-foreground")}
              >
                {showSaveNameError ? saveNameError : "Required."}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="save-dialog-category" className="text-xs font-medium">
                Category
              </Label>
              <Select value={saveCategory} onValueChange={setSaveCategory}>
                <SelectTrigger id="save-dialog-category" className="bg-background">
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
            </div>
            <div className="space-y-1">
              <Label htmlFor="save-dialog-description" className="text-xs font-medium">
                Description
              </Label>
              <Textarea
                id="save-dialog-description"
                value={saveDescription}
                onChange={(event) => setSaveDescription(event.target.value)}
                placeholder="Description (optional)"
                className="min-h-[80px] bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="save-dialog-tags" className="text-xs font-medium">
                Tags
              </Label>
              <Input
                id="save-dialog-tags"
                value={saveTags}
                onChange={(event) => setSaveTags(event.target.value)}
                placeholder="Tags (comma-separated, optional)"
                className="bg-background"
              />
            </div>
            {remixContext && (
              <div className="space-y-1">
                <Label htmlFor="save-dialog-remix-note" className="text-xs font-medium">
                  Remix note
                </Label>
                <Textarea
                  id="save-dialog-remix-note"
                  value={saveRemixNote}
                  onChange={(event) => setSaveRemixNote(event.target.value)}
                  placeholder="Remix note (optional)"
                  className="min-h-[80px] bg-background"
                />
              </div>
            )}

            {phase2Enabled && (
              <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="save-dialog-share-toggle" className="text-xs font-medium text-foreground">
                      Share to community
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable to publish after saving.
                    </p>
                  </div>
                  <Switch
                    id="save-dialog-share-toggle"
                    checked={shareEnabledForUi}
                    onCheckedChange={handleShareToggleChange}
                    disabled={!canSharePrompt}
                  />
                </div>
                {!canSharePrompt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sign in to enable sharing.
                  </p>
                )}
              </div>
            )}

            {shareEnabledForUi && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="save-dialog-use-case" className="text-xs font-medium">
                    Use case
                  </Label>
                  <Textarea
                    id="save-dialog-use-case"
                    value={saveUseCase}
                    onChange={(event) => setSaveUseCase(event.target.value)}
                    onBlur={() => setSaveUseCaseTouched(true)}
                    placeholder="Describe how this prompt should be used"
                    className="min-h-[90px] bg-background"
                    aria-invalid={showSaveUseCaseError}
                    aria-describedby="save-dialog-use-case-help"
                  />
                  <p
                    id="save-dialog-use-case-help"
                    className={cn("text-xs", showSaveUseCaseError ? "text-destructive" : "text-muted-foreground")}
                  >
                    {showSaveUseCaseError ? saveUseCaseError : "Required when sharing."}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="save-dialog-target-model" className="text-xs font-medium">
                    Target model
                  </Label>
                  <Input
                    id="save-dialog-target-model"
                    value={saveTargetModel}
                    onChange={(event) => setSaveTargetModel(event.target.value)}
                    placeholder="Target model (optional)"
                    className="bg-background"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="save-dialog-confirm-safe"
                    checked={saveConfirmedSafe}
                    onCheckedChange={(checked) => {
                      setSaveConfirmedSafe(checked === true);
                      setSaveConfirmedSafeTouched(true);
                    }}
                    className="mt-0.5"
                    aria-invalid={showSaveConfirmedSafeError}
                    aria-describedby="save-dialog-confirm-safe-help"
                  />
                  <Label
                    htmlFor="save-dialog-confirm-safe"
                    className="cursor-pointer text-xs leading-snug text-muted-foreground"
                  >
                    I confirm this prompt contains no secrets or private data.
                  </Label>
                </div>
                <p
                  id="save-dialog-confirm-safe-help"
                  className={cn(
                    "text-xs",
                    showSaveConfirmedSafeError ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {showSaveConfirmedSafeError ? saveConfirmedSafeError : "Required when sharing."}
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleSaveDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="brandPrimary" onClick={handleSaveSubmit}>
              {shareEnabledForUi ? "Save & Share" : "Save Prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {displayedReasoningSummary && (
        <Card
          className={cn(
            "border-amber-500/30 bg-amber-500/5 p-3 transition-opacity duration-1000 ease-out",
            isReasoningSummaryFading && "opacity-0",
          )}
        >
          <p className="ui-section-label text-amber-700">
            Reasoning summary
          </p>
          <div className="prose prose-sm mt-2 max-w-none whitespace-normal text-foreground/90 dark:prose-invert prose-headings:my-1 prose-p:my-1 prose-pre:my-1 prose-code:break-words prose-ul:my-1 prose-ol:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayedReasoningSummary}
            </ReactMarkdown>
          </div>
        </Card>
      )}

      <Card
        className={cn(
          "enhance-output-frame flex-1 p-4 bg-card overflow-auto",
          isStreamingVisual && "enhance-output-streaming",
          isSettledVisual && "enhance-output-complete"
        )}
      >
        {displayPrompt ? (
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
            {displayPrompt}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[120px] sm:min-h-[200px]">
            <p className="text-sm text-muted-foreground text-center">
              Your output appears here.
              <br />
              Enter a prompt or choose a template.
            </p>
          </div>
        )}
      </Card>

      {webSearchSources.length > 0 && (
        <div className="px-1 pt-1 pb-0">
          <p className="ui-section-label mb-1 text-muted-foreground">Sources</p>
          <ul className="space-y-0.5">
            {webSearchSources.map((source, i) => {
              const safeLink = parseWebSourceLink(source);
              return (
                <li key={i} className="text-xs text-muted-foreground">
                  {safeLink ? (
                    <a
                      href={safeLink.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {safeLink.title}
                    </a>
                  ) : (
                    source
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!hideEnhanceButton && (
        <div className="flex flex-col gap-2">
          {onWebSearchToggle && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <Switch
                  checked={webSearchEnabled}
                  onCheckedChange={onWebSearchToggle}
                  disabled={isEnhancing}
                  aria-label="Enable web search during enhancement"
                />
                <Globe className="w-3.5 h-3.5" />
                <span>Use web sources</span>
              </label>
            </div>
          )}
          <Button
            variant="brandPrimary"
            size="lg"
            onClick={onEnhance}
            disabled={isEnhancing || !builtPrompt}
            className="signature-enhance-button w-full gap-2"
            data-phase={enhancePhase}
          >
            {isEnhancing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {enhanceLabel}
              </>
            ) : (
              <>
                {enhancePhase === "done" ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {enhanceLabel}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const marker = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
  const rowClass =
    line.type === "add"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : line.type === "remove"
        ? "bg-red-500/10 text-red-700 dark:text-red-300"
        : "text-foreground";

  return (
    <div className={`px-3 whitespace-pre-wrap break-words ${rowClass}`}>
      <span className="inline-block w-4 select-none">{marker}</span>
      {line.value}
    </div>
  );
}
