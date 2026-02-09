import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Sparkles, Save, Loader2, GitCompare } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { buildLineDiff, type DiffLine } from "@/lib/text-diff";
import { cn } from "@/lib/utils";

export type EnhancePhase = "idle" | "starting" | "streaming" | "settling" | "done";

interface OutputPanelProps {
  builtPrompt: string;
  enhancedPrompt: string;
  isEnhancing: boolean;
  onEnhance: () => void;
  onSaveVersion: () => void;
  onSaveTemplate: (input: { name: string; description?: string; tags?: string[] }) => void;
  canSaveTemplate: boolean;
  hideEnhanceButton?: boolean;
  enhancePhase?: EnhancePhase;
}

export function OutputPanel({
  builtPrompt,
  enhancedPrompt,
  isEnhancing,
  onEnhance,
  onSaveVersion,
  onSaveTemplate,
  canSaveTemplate,
  hideEnhanceButton = false,
  enhancePhase = "idle",
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateTags, setTemplateTags] = useState("");
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

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const tags = Array.from(
      new Set(
        templateTags
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    ).slice(0, 8);

    onSaveTemplate({
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
    setTemplateDialogOpen(false);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateTags("");
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
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!canSaveTemplate} className="gap-1 text-xs">
                <Save className="w-3 h-3" />
                Save Preset
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Save as Preset</DialogTitle>
                <DialogDescription>
                  Snapshot the full prompt and context configuration for reuse.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Preset name"
                  className="bg-background"
                />
                <Textarea
                  value={templateDescription}
                  onChange={(event) => setTemplateDescription(event.target.value)}
                  placeholder="Description (optional)"
                  className="min-h-[90px] bg-background"
                />
                <Input
                  value={templateTags}
                  onChange={(event) => setTemplateTags(event.target.value)}
                  placeholder="Tags (comma-separated, optional)"
                  className="bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Example: marketing, seo, long-form
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                  Save Preset
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" onClick={onSaveVersion} disabled={!displayPrompt} className="gap-1 text-xs">
            <Save className="w-3 h-3" />
            Save
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
              Start by entering a prompt or choosing a preset.
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
