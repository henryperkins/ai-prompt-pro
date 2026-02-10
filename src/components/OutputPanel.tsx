import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Sparkles, Save, Loader2, GitCompare, Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
import { buildLineDiff, type DiffLine } from "@/lib/text-diff";
import { cn } from "@/lib/utils";

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

  const { toast } = useToast();
  const displayPrompt = enhancedPrompt || builtPrompt;
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
  const hasCompare = Boolean(
    builtPrompt.trim() && enhancedPrompt.trim() && builtPrompt.trim() !== enhancedPrompt.trim()
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
    if (!promptName.trim()) return;

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
  };

  const handleSaveAndSharePrompt = () => {
    if (!canSharePrompt) return;
    if (!shareName.trim() || !shareUseCase.trim() || !shareConfirmedSafe) return;

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
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">
            {enhancedPrompt ? "✨ Enhanced Prompt" : "📝 Preview"}
          </h2>
          {statusLabel && (
            <span className="interactive-chip inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {statusLabel}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!hasCompare} className="gap-1 text-xs">
                <GitCompare className="w-3 h-3" />
                Compare
              </Button>
            </DialogTrigger>
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

          <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!canSavePrompt} className="gap-1 text-xs">
                <Save className="w-3 h-3" />
                Save Prompt
              </Button>
            </DialogTrigger>
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
                <Input
                  value={promptName}
                  onChange={(event) => setPromptName(event.target.value)}
                  placeholder="Prompt title"
                  className="bg-background"
                />
                <Select value={promptCategory} onValueChange={setPromptCategory}>
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
                  value={promptDescription}
                  onChange={(event) => setPromptDescription(event.target.value)}
                  placeholder="Description (optional)"
                  className="min-h-[90px] bg-background"
                />
                <Input
                  value={promptTags}
                  onChange={(event) => setPromptTags(event.target.value)}
                  placeholder="Tags (comma-separated, optional)"
                  className="bg-background"
                />
                {remixContext && (
                  <Textarea
                    value={promptRemixNote}
                    onChange={(event) => setPromptRemixNote(event.target.value)}
                    placeholder="Remix note (optional)"
                    className="min-h-[80px] bg-background"
                  />
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPromptDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSavePrompt} disabled={!promptName.trim()}>
                  Save Prompt
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!canSharePrompt} className="gap-1 text-xs">
                <Share2 className="w-3 h-3" />
                Save & Share
              </Button>
            </DialogTrigger>
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
                {remixContext && (
                  <Textarea
                    value={shareRemixNote}
                    onChange={(event) => setShareRemixNote(event.target.value)}
                    placeholder="Remix note (optional)"
                    className="min-h-[80px] bg-background"
                  />
                )}
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={shareConfirmedSafe}
                    onChange={(event) => setShareConfirmedSafe(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>I confirm this prompt contains no secrets or private data.</span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAndSharePrompt}
                  disabled={!shareName.trim() || !shareUseCase.trim() || !shareConfirmedSafe}
                >
                  Save & Share
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="ghost" size="sm" onClick={onSaveVersion} disabled={!displayPrompt} className="gap-1 text-xs">
            <Save className="w-3 h-3" />
            Save Version
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!displayPrompt} className="gap-1 text-xs">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

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
