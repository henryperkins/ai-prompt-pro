import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Sparkles, Save, Loader2, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
import {
  validateSaveAndSharePromptInput,
  validateSavePromptInput,
} from "@/lib/output-panel-validation";
import { buildLineDiff, type DiffLine } from "@/lib/text-diff";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export type EnhancePhase = "idle" | "starting" | "streaming" | "settling" | "done";

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
  remixContext?: { title: string; authorName: string };
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
  remixContext,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  const [promptName, setPromptName] = useState("");
  const [promptDescription, setPromptDescription] = useState("");
  const [promptTags, setPromptTags] = useState("");
  const [promptCategory, setPromptCategory] = useState("general");
  const [promptRemixNote, setPromptRemixNote] = useState("");

  const [shareName, setShareName] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareTags, setShareTags] = useState("");
  const [shareCategory, setShareCategory] = useState("general");
  const [shareUseCase, setShareUseCase] = useState("");
  const [shareTargetModel, setShareTargetModel] = useState("");
  const [shareConfirmedSafe, setShareConfirmedSafe] = useState(false);
  const [shareRemixNote, setShareRemixNote] = useState("");
  const [promptNameTouched, setPromptNameTouched] = useState(false);
  const [promptSubmitAttempted, setPromptSubmitAttempted] = useState(false);
  const [shareNameTouched, setShareNameTouched] = useState(false);
  const [shareUseCaseTouched, setShareUseCaseTouched] = useState(false);
  const [shareConfirmedSafeTouched, setShareConfirmedSafeTouched] = useState(false);
  const [shareSubmitAttempted, setShareSubmitAttempted] = useState(false);

  const { toast } = useToast();
  const displayPrompt = enhancedPrompt || builtPrompt;
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
      await navigator.clipboard.writeText(command);
      toast({
        title: "Copied for Codex",
        description:
          variant === "exec"
            ? "Copied `codex exec` stdin command."
            : variant === "tui"
              ? "Copied `codex` TUI command."
              : "Copied app-server debug command.",
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
      await navigator.clipboard.writeText(command);
      toast({
        title: "Copied for Codex",
        description: `Copied command to scaffold .agents/skills/${codexExport.CODEX_DEFAULT_SKILL_NAME}/SKILL.md.`,
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
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "SKILL.md generation is unavailable.",
        variant: "destructive",
      });
    }
  };

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
      : "Enhance with AI";
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
  const promptValidationErrors = validateSavePromptInput(promptName);
  const promptNameError = promptValidationErrors.name ?? null;
  const showPromptNameError = Boolean(promptNameError && (promptNameTouched || promptSubmitAttempted));
  const shareValidationErrors = validateSaveAndSharePromptInput({
    name: shareName,
    useCase: shareUseCase,
    confirmedSafe: shareConfirmedSafe,
  });
  const shareNameError = shareValidationErrors.name ?? null;
  const showShareNameError = Boolean(shareNameError && (shareNameTouched || shareSubmitAttempted));
  const shareUseCaseError = shareValidationErrors.useCase ?? null;
  const showShareUseCaseError = Boolean(shareUseCaseError && (shareUseCaseTouched || shareSubmitAttempted));
  const shareConfirmedSafeError = shareValidationErrors.confirmedSafe ?? null;
  const showShareConfirmedSafeError = Boolean(
    shareConfirmedSafeError && (shareConfirmedSafeTouched || shareSubmitAttempted),
  );

  const diff = useMemo(() => {
    if (!hasCompare) return null;
    return buildLineDiff(builtPrompt, enhancedPrompt);
  }, [hasCompare, builtPrompt, enhancedPrompt]);

  useEffect(() => {
    if (remixContext) {
      if (!promptName.trim()) {
        setPromptName(`Remix of ${remixContext.title}`);
      }
      if (!shareName.trim()) {
        setShareName(`Remix of ${remixContext.title}`);
      }
    } else {
      setPromptRemixNote("");
      setShareRemixNote("");
    }
  }, [remixContext, promptName, shareName]);

  const handleCopy = async () => {
    if (!displayPrompt) return;
    try {
      await navigator.clipboard.writeText(displayPrompt);
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

  const handleSavePrompt = () => {
    setPromptSubmitAttempted(true);
    if (promptNameError) {
      setPromptNameTouched(true);
      return;
    }

    onSavePrompt({
      name: promptName.trim(),
      description: promptDescription.trim() || undefined,
      tags: parseTags(promptTags),
      category: promptCategory,
      remixNote: remixContext ? promptRemixNote.trim() || undefined : undefined,
    });

    setPromptDialogOpen(false);
    setPromptName("");
    setPromptDescription("");
    setPromptTags("");
    setPromptCategory("general");
    setPromptRemixNote("");
    setPromptNameTouched(false);
    setPromptSubmitAttempted(false);
  };

  const handleSaveAndSharePrompt = () => {
    if (!canSharePrompt) return;
    setShareSubmitAttempted(true);
    if (shareNameError || shareUseCaseError || shareConfirmedSafeError) {
      setShareNameTouched(true);
      setShareUseCaseTouched(true);
      setShareConfirmedSafeTouched(true);
      return;
    }

    onSaveAndSharePrompt({
      name: shareName.trim(),
      description: shareDescription.trim() || undefined,
      tags: parseTags(shareTags),
      category: shareCategory,
      useCase: shareUseCase.trim(),
      targetModel: shareTargetModel.trim() || undefined,
      remixNote: remixContext ? shareRemixNote.trim() || undefined : undefined,
    });

    setShareDialogOpen(false);
    setShareName("");
    setShareDescription("");
    setShareTags("");
    setShareCategory("general");
    setShareUseCase("");
    setShareTargetModel("");
    setShareConfirmedSafe(false);
    setShareRemixNote("");
    setShareNameTouched(false);
    setShareUseCaseTouched(false);
    setShareConfirmedSafeTouched(false);
    setShareSubmitAttempted(false);
  };

  const handlePromptDialogOpenChange = (open: boolean) => {
    setPromptDialogOpen(open);
    if (open) return;
    setPromptNameTouched(false);
    setPromptSubmitAttempted(false);
  };

  const handleShareDialogOpenChange = (open: boolean) => {
    setShareDialogOpen(open);
    if (open) return;
    setShareNameTouched(false);
    setShareUseCaseTouched(false);
    setShareConfirmedSafeTouched(false);
    setShareSubmitAttempted(false);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {enhanceAssistiveStatus}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">
            {enhancedPrompt ? "✨ Enhanced Prompt" : "📝 Preview"}
          </h2>
          {statusLabel && (
            <span className="interactive-chip inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {statusLabel}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={handleCopy}
            disabled={!displayPrompt}
            className="gap-1.5 text-xs font-semibold min-w-[96px] shadow-md"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!canUseSaveMenu} className="gap-1.5 text-xs">
                <Save className="w-3 h-3" />
                Save
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!canSavePrompt} onSelect={() => setPromptDialogOpen(true)}>
                Save Prompt
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canSharePrompt} onSelect={() => setShareDialogOpen(true)}>
                Save & Share
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!displayPrompt} onSelect={() => onSaveVersion()}>
                Save Version
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <MoreHorizontal className="w-3 h-3" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!hasCompare} onSelect={() => setCompareDialogOpen(true)}>
                Compare changes
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleCopyCodex("exec")}>
                Copy `codex exec` (stdin)
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleCopyCodex("tui")}>
                Copy `codex` (TUI prefilled)
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleCopyCodex("appServer")}>
                Copy app-server send-message-v2
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!displayPrompt} onSelect={() => void handleCopyCodexSkillScaffold()}>
                Copy skill scaffold command
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

      <Dialog open={promptDialogOpen} onOpenChange={handlePromptDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Prompt</DialogTitle>
            <DialogDescription>
              Save a private prompt snapshot to your library.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {remixContext && (
              <div className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
                Remixing {remixContext.authorName}’s “{remixContext.title}”
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="save-prompt-name" className="text-xs font-medium">
                Prompt title
              </Label>
              <Input
                id="save-prompt-name"
                value={promptName}
                onChange={(event) => setPromptName(event.target.value)}
                onBlur={() => setPromptNameTouched(true)}
                placeholder="Prompt title"
                className="bg-background"
                aria-invalid={showPromptNameError}
                aria-describedby="save-prompt-name-help"
              />
              <p
                id="save-prompt-name-help"
                className={cn("text-xs", showPromptNameError ? "text-destructive" : "text-muted-foreground")}
              >
                {showPromptNameError ? promptNameError : "Required."}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="save-prompt-category" className="text-xs font-medium">
                Category
              </Label>
              <Select value={promptCategory} onValueChange={setPromptCategory}>
                <SelectTrigger id="save-prompt-category" className="bg-background">
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
              <Label htmlFor="save-prompt-description" className="text-xs font-medium">
                Description
              </Label>
              <Textarea
                id="save-prompt-description"
                value={promptDescription}
                onChange={(event) => setPromptDescription(event.target.value)}
                placeholder="Description (optional)"
                className="min-h-[90px] bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="save-prompt-tags" className="text-xs font-medium">
                Tags
              </Label>
              <Input
                id="save-prompt-tags"
                value={promptTags}
                onChange={(event) => setPromptTags(event.target.value)}
                placeholder="Tags (comma-separated, optional)"
                className="bg-background"
              />
            </div>
            {remixContext && (
              <div className="space-y-1">
                <Label htmlFor="save-prompt-remix-note" className="text-xs font-medium">
                  Remix note
                </Label>
                <Textarea
                  id="save-prompt-remix-note"
                  value={promptRemixNote}
                  onChange={(event) => setPromptRemixNote(event.target.value)}
                  placeholder="Remix note (optional)"
                  className="min-h-[80px] bg-background"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handlePromptDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePrompt}>
              Save Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={handleShareDialogOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Save & Share Prompt</DialogTitle>
            <DialogDescription>
              Publish this prompt recipe to the community feed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {remixContext && (
              <div className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
                Remixing {remixContext.authorName}’s “{remixContext.title}”
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="share-prompt-name" className="text-xs font-medium">
                Prompt title
              </Label>
              <Input
                id="share-prompt-name"
                value={shareName}
                onChange={(event) => setShareName(event.target.value)}
                onBlur={() => setShareNameTouched(true)}
                placeholder="Prompt title"
                className="bg-background"
                aria-invalid={showShareNameError}
                aria-describedby="share-prompt-name-help"
              />
              <p
                id="share-prompt-name-help"
                className={cn("text-xs", showShareNameError ? "text-destructive" : "text-muted-foreground")}
              >
                {showShareNameError ? shareNameError : "Required."}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="share-prompt-category" className="text-xs font-medium">
                Category
              </Label>
              <Select value={shareCategory} onValueChange={setShareCategory}>
                <SelectTrigger id="share-prompt-category" className="bg-background">
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
              <Label htmlFor="share-prompt-description" className="text-xs font-medium">
                Description
              </Label>
              <Textarea
                id="share-prompt-description"
                value={shareDescription}
                onChange={(event) => setShareDescription(event.target.value)}
                placeholder="Description (optional)"
                className="min-h-[80px] bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="share-prompt-tags" className="text-xs font-medium">
                Tags
              </Label>
              <Input
                id="share-prompt-tags"
                value={shareTags}
                onChange={(event) => setShareTags(event.target.value)}
                placeholder="Tags (comma-separated, optional)"
                className="bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="share-prompt-use-case" className="text-xs font-medium">
                Use case
              </Label>
              <Textarea
                id="share-prompt-use-case"
                value={shareUseCase}
                onChange={(event) => setShareUseCase(event.target.value)}
                onBlur={() => setShareUseCaseTouched(true)}
                placeholder="Describe how this prompt should be used"
                className="min-h-[90px] bg-background"
                aria-invalid={showShareUseCaseError}
                aria-describedby="share-prompt-use-case-help"
              />
              <p
                id="share-prompt-use-case-help"
                className={cn("text-xs", showShareUseCaseError ? "text-destructive" : "text-muted-foreground")}
              >
                {showShareUseCaseError ? shareUseCaseError : "Required."}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="share-prompt-target-model" className="text-xs font-medium">
                Target model
              </Label>
              <Input
                id="share-prompt-target-model"
                value={shareTargetModel}
                onChange={(event) => setShareTargetModel(event.target.value)}
                placeholder="Target model (optional)"
                className="bg-background"
              />
            </div>
            {remixContext && (
              <div className="space-y-1">
                <Label htmlFor="share-prompt-remix-note" className="text-xs font-medium">
                  Remix note
                </Label>
                <Textarea
                  id="share-prompt-remix-note"
                  value={shareRemixNote}
                  onChange={(event) => setShareRemixNote(event.target.value)}
                  placeholder="Remix note (optional)"
                  className="min-h-[80px] bg-background"
                />
              </div>
            )}
            <div className="flex items-start gap-2">
              <Checkbox
                id="share-confirm-safe"
                checked={shareConfirmedSafe}
                onCheckedChange={(checked) => {
                  setShareConfirmedSafe(checked === true);
                  setShareConfirmedSafeTouched(true);
                }}
                className="mt-0.5"
                aria-invalid={showShareConfirmedSafeError}
                aria-describedby="share-confirm-safe-help"
              />
              <Label
                htmlFor="share-confirm-safe"
                className="cursor-pointer text-xs leading-snug text-muted-foreground"
              >
                I confirm this prompt contains no secrets or private data.
              </Label>
            </div>
            <p
              id="share-confirm-safe-help"
              className={cn(
                "text-xs",
                showShareConfirmedSafeError ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {showShareConfirmedSafeError ? shareConfirmedSafeError : "Required."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleShareDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAndSharePrompt}>
              Save & Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Your enhanced prompt will appear here.
              <br />
              Start by entering a prompt or choosing a template.
            </p>
          </div>
        )}
      </Card>

      {!hideEnhanceButton && (
        <Button
          variant="glow"
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
