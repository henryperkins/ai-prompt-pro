import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card } from "@/components/base/card";
import { Button } from "@/components/base/buttons/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/base/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/base/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { copyTextToClipboard } from "@/lib/clipboard";
import { trackBuilderEvent } from "@/lib/telemetry";
import { buildLineDiff, type DiffLine } from "@/lib/text-diff";
import {
  UI_STATUS_ROW_CLASSES,
  UI_STATUS_SURFACE_CLASSES,
  UI_STATUS_TEXT_CLASSES,
} from "@/lib/ui-status";
import { cx } from "@/lib/utils/cx";
import { normalizeHttpUrl } from "@/lib/url-utils";
import { Switch } from "@/components/base/switch";
import { WebSearchActivityIndicator } from "@/components/WebSearchActivityIndicator";
import type { WebSearchActivity } from "@/lib/enhance-web-search-stream";
import type { EnhanceMetadata } from "@/lib/enhance-metadata";
import type { AmbiguityMode, EnhancementDepth, RewriteStrictness } from "@/lib/user-preferences";
import {
  OutputPanelSaveDialog,
  type SavePromptInput,
  type SaveAndSharePromptInput,
} from "@/components/OutputPanelSaveDialog";
import { OutputPanelDevTools } from "@/components/OutputPanelDevTools";
import { EnhancementInspector, type ApplyToBuilderUpdate } from "@/components/EnhancementInspector";
import {
  Check,
  Copy,
  DotsThreeOutline as MoreHorizontal,
  FloppyDisk as Save,
  Globe,
  Sparkle as Sparkles,
  SpinnerGap as Loader2,
} from "@phosphor-icons/react";

export type EnhancePhase = "idle" | "starting" | "streaming" | "settling" | "done";
export type OutputPreviewSource = "empty" | "prompt_text" | "builder_fields" | "enhanced";
export type EnhancementVariant = "original" | "shorter" | "more_detailed";
export type { SavePromptInput, SaveAndSharePromptInput };
const REASONING_SUMMARY_FADE_MS = 900;

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
  webSearchActivity?: WebSearchActivity;
  reasoningSummary?: string;
  previewSource?: OutputPreviewSource;
  hasEnhancedOnce?: boolean;
  enhanceMetadata?: EnhanceMetadata | null;
  activeVariant?: EnhancementVariant;
  onVariantChange?: (variant: EnhancementVariant) => void;
  onPromptUsed?: () => void;
  enhancementDepth?: EnhancementDepth;
  rewriteStrictness?: RewriteStrictness;
  onEnhancementDepthChange?: (depth: EnhancementDepth) => void;
  onRewriteStrictnessChange?: (strictness: RewriteStrictness) => void;
  ambiguityMode?: AmbiguityMode;
  onAmbiguityModeChange?: (mode: AmbiguityMode) => void;
  onApplyToBuilder?: (updates: ApplyToBuilderUpdate) => void;
}

export type { ApplyToBuilderUpdate };

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
  webSearchActivity,
  reasoningSummary = "",
  previewSource,
  hasEnhancedOnce = true,
  enhanceMetadata,
  activeVariant,
  onVariantChange,
  onPromptUsed,
  enhancementDepth = "guided",
  rewriteStrictness = "balanced",
  onEnhancementDepthChange,
  onRewriteStrictnessChange,
  ambiguityMode = "infer_conservatively",
  onAmbiguityModeChange,
  onApplyToBuilder,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogShareIntent, setSaveDialogShareIntent] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [internalActiveVariant, setInternalActiveVariant] = useState<EnhancementVariant>("original");

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const resolvedActiveVariant = activeVariant ?? internalActiveVariant;
  const variantPrompt =
    resolvedActiveVariant === "shorter" && enhanceMetadata?.alternativeVersions?.shorter
      ? enhanceMetadata.alternativeVersions.shorter
      : resolvedActiveVariant === "more_detailed" && enhanceMetadata?.alternativeVersions?.more_detailed
        ? enhanceMetadata.alternativeVersions.more_detailed
        : null;
  const displayPrompt = variantPrompt || enhancedPrompt || builtPrompt;
  const inferredPreviewSource: OutputPreviewSource = enhancedPrompt.trim()
    ? "enhanced"
    : builtPrompt.trim()
      ? "builder_fields"
      : "empty";
  const effectivePreviewSource = previewSource ?? inferredPreviewSource;
  const previewSourceLabel =
    effectivePreviewSource === "enhanced"
      ? "Enhanced output"
      : effectivePreviewSource === "prompt_text"
        ? "Prompt draft"
        : effectivePreviewSource === "builder_fields"
          ? "Built prompt"
          : "No preview yet";
  const trimmedReasoningSummary = reasoningSummary.trim();
  const [displayedReasoningSummary, setDisplayedReasoningSummary] = useState(trimmedReasoningSummary);
  const [isReasoningSummaryFading, setIsReasoningSummaryFading] = useState(false);

  useEffect(() => {
    setInternalActiveVariant("original");
  }, [enhanceMetadata]);

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
    builtPrompt.trim() && displayPrompt.trim() && builtPrompt.trim() !== displayPrompt.trim()
  );
  const hasPreviewContent = displayPrompt.trim().length > 0;
  const showUtilityActions = hasEnhancedOnce || hasPreviewContent;
  const canUseSaveMenu = canSavePrompt || canSharePrompt || hasPreviewContent;

  const diff = useMemo(() => {
    if (!compareDialogOpen || !hasCompare) return null;
    return buildLineDiff(builtPrompt, displayPrompt);
  }, [compareDialogOpen, hasCompare, builtPrompt, displayPrompt]);

  const handleVariantChange = (variant: EnhancementVariant) => {
    if (activeVariant === undefined) {
      setInternalActiveVariant(variant);
    }
    onVariantChange?.(variant);
    if (variant !== "original") {
      const variantText =
        variant === "shorter"
          ? enhanceMetadata?.alternativeVersions?.shorter
          : enhanceMetadata?.alternativeVersions?.more_detailed;
      trackBuilderEvent("builder_enhance_variant_applied", {
        variant,
        originalPromptChars: enhancedPrompt.length,
        variantPromptChars: variantText?.length ?? 0,
      });
    }
  };

  const handleCopy = async () => {
    if (!displayPrompt) return;
    try {
      if (!hasEnhancedOnce) {
        trackBuilderEvent("builder_copy_pre_enhance", {
          previewSource: effectivePreviewSource,
        });
      }
      await copyTextToClipboard(displayPrompt);
      setCopied(true);
      onPromptUsed?.();
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

  const openSaveDialog = (share: boolean) => {
    if (!hasEnhancedOnce) {
      trackBuilderEvent("builder_save_pre_enhance_attempt", {
        shareRequested: share,
      });
    }
    if (share && !canSharePrompt) return;
    trackBuilderEvent("builder_save_clicked", { shareEnabled: share });
    setSaveDialogShareIntent(share);
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
          <span className="interactive-chip inline-flex items-center rounded-full border border-border/80 bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Source: {previewSourceLabel}
          </span>
          {statusLabel && (
            <span className="interactive-chip inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {statusLabel}
            </span>
          )}
          {hasCompare && (
            <Button
              type="button"
              variant="secondary"
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
            variant="primary"
            size="sm"
            onClick={handleCopy}
            disabled={!displayPrompt}
            className="ui-toolbar-button utility-action-button min-w-[84px]"
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied!" : hasEnhancedOnce ? "Copy" : "Copy preview"}
          </Button>

          {showUtilityActions && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" disabled={!canUseSaveMenu} className="ui-toolbar-button gap-1.5">
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
                  <Button variant="tertiary" size="sm" className="ui-toolbar-button gap-1.5">
                    <MoreHorizontal className="w-3 h-3" />
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <OutputPanelDevTools displayPrompt={displayPrompt} isMobile={isMobile} />
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
      {!showUtilityActions && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Save and developer tools unlock once preview content is available.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ui-toolbar-button gap-1.5"
              isDisabled
              title="Enter a prompt to unlock saving"
            >
              <Save className="w-3 h-3" />
              Save
            </Button>
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              className="ui-toolbar-button gap-1.5"
              isDisabled
              title="Enter a prompt to unlock options"
            >
              <MoreHorizontal className="w-3 h-3" />
              More
            </Button>
          </div>
        </div>
      )}

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

      <OutputPanelSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        initialShareEnabled={saveDialogShareIntent}
        canSharePrompt={canSharePrompt}
        phase2Enabled={phase2Enabled}
        remixContext={remixContext}
        onSavePrompt={onSavePrompt}
        onSaveAndSharePrompt={onSaveAndSharePrompt}
      />

      {displayedReasoningSummary && (
        <Card
          className={cx(
            "p-3 transition-opacity duration-1000 ease-out",
            UI_STATUS_SURFACE_CLASSES.warning,
            isReasoningSummaryFading && "opacity-0",
          )}
        >
          <p className={cx("ui-section-label", UI_STATUS_TEXT_CLASSES.warning)}>
            Reasoning summary
          </p>
          <div className="prose prose-sm mt-2 max-w-none whitespace-normal text-foreground/90 dark:prose-invert prose-headings:my-1 prose-p:my-1 prose-pre:my-1 prose-code:break-words prose-ul:my-1 prose-ol:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayedReasoningSummary}
            </ReactMarkdown>
          </div>
        </Card>
      )}

      {webSearchActivity && webSearchActivity.phase !== "idle" && (
        <WebSearchActivityIndicator
          phase={webSearchActivity.phase}
          query={webSearchActivity.query}
          searchCount={webSearchActivity.searchCount}
        />
      )}

      <Card
        className={cx(
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

      {enhanceMetadata && !isEnhancing && (
        <EnhancementSummary
          metadata={enhanceMetadata}
          activeVariant={resolvedActiveVariant}
          onVariantChange={handleVariantChange}
        />
      )}

      {enhanceMetadata && !isEnhancing && (enhanceMetadata.partsBreakdown || enhanceMetadata.enhancementPlan) && (
        <EnhancementInspector
          metadata={enhanceMetadata}
          onApplyToBuilder={onApplyToBuilder}
        />
      )}

      {webSearchSources.length > 0 && (
        <div className="px-1 pt-1 pb-0">
          <p className="ui-section-label mb-1 text-muted-foreground">Sources</p>
          <ul className="space-y-0.5">
            {webSearchSources.map((source, i) => {
              const safeLink = parseWebSourceLink(source);
              return (
                <li key={i} className="text-sm text-muted-foreground">
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
          {onWebSearchToggle ? (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch
                checked={webSearchEnabled}
                onCheckedChange={onWebSearchToggle}
                disabled={isEnhancing}
                aria-label="Enable web search during enhancement"
              />
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Web lookup</span>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Web lookup: {webSearchEnabled ? "On" : "Off"}
            </p>
          )}
          {(onEnhancementDepthChange || onRewriteStrictnessChange || onAmbiguityModeChange) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {onEnhancementDepthChange && (
                <EnhanceOptionGroup
                  label="Depth"
                  value={enhancementDepth}
                  options={ENHANCEMENT_DEPTH_OPTIONS}
                  onChange={onEnhancementDepthChange}
                  disabled={isEnhancing}
                />
              )}
              {onRewriteStrictnessChange && (
                <EnhanceOptionGroup
                  label="Strictness"
                  value={rewriteStrictness}
                  options={REWRITE_STRICTNESS_OPTIONS}
                  onChange={onRewriteStrictnessChange}
                  disabled={isEnhancing}
                />
              )}
              {onAmbiguityModeChange && (
                <EnhanceOptionGroup
                  label="Ambiguity"
                  value={ambiguityMode}
                  options={AMBIGUITY_MODE_OPTIONS}
                  onChange={onAmbiguityModeChange}
                  disabled={isEnhancing}
                />
              )}
            </div>
          )}
          <Button
            variant="primary"
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

const ENHANCEMENT_DEPTH_OPTIONS: { value: EnhancementDepth; label: string }[] = [
  { value: "quick", label: "Light polish" },
  { value: "guided", label: "Structured rewrite" },
  { value: "advanced", label: "Expert prompt" },
];

const AMBIGUITY_MODE_OPTIONS: { value: AmbiguityMode; label: string }[] = [
  { value: "ask_me", label: "Ask me" },
  { value: "placeholders", label: "Use placeholders" },
  { value: "infer_conservatively", label: "Infer conservatively" },
];

const REWRITE_STRICTNESS_OPTIONS: { value: RewriteStrictness; label: string }[] = [
  { value: "preserve", label: "Preserve wording" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Optimize aggressively" },
];

function EnhanceOptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <span className="text-xs font-medium text-muted-foreground">{label}:</span>
      <div className="inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5 gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={opt.value === value}
            onClick={() => onChange(opt.value)}
            className={cx(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              opt.value === value
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EnhancementSummary({
  metadata,
  activeVariant,
  onVariantChange,
}: {
  metadata: EnhanceMetadata;
  activeVariant: EnhancementVariant;
  onVariantChange: (variant: EnhancementVariant) => void;
}) {
  const ctx = metadata.detectedContext;
  const hasDetected = ctx && (ctx.intent.length > 0 || ctx.domain.length > 0);
  const hasChanges = metadata.enhancementsMade && metadata.enhancementsMade.length > 0;
  const hasMissing = metadata.missingParts && metadata.missingParts.length > 0;
  const hasSuggestions = metadata.suggestions && metadata.suggestions.length > 0;
  const hasVariants =
    metadata.alternativeVersions &&
    (metadata.alternativeVersions.shorter || metadata.alternativeVersions.more_detailed);
  const hasAssumptions = metadata.assumptionsMade && metadata.assumptionsMade.length > 0;
  const hasQuestions = metadata.openQuestions && metadata.openQuestions.length > 0;

  if (!hasDetected && !hasChanges && !hasMissing && !hasSuggestions && !hasVariants && !hasAssumptions && !hasQuestions) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-2 text-sm">
      {hasDetected && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Detected:</span>
          {ctx.intent.map((intent) => (
            <span
              key={intent}
              className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {intent}
            </span>
          ))}
          {ctx.domain.map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {domain}
            </span>
          ))}
          {ctx.complexity > 0 && (
            <span className="text-xs text-muted-foreground">
              complexity {ctx.complexity}/5
            </span>
          )}
        </div>
      )}

      {hasChanges && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">What changed:</p>
          <ul className="space-y-0.5">
            {metadata.enhancementsMade!.map((change, i) => (
              <li key={i} className="text-xs text-foreground/80 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-muted-foreground">
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasMissing && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Watch-outs:</p>
          <ul className="space-y-0.5">
            {metadata.missingParts!.map((part, i) => (
              <li key={i} className="text-xs text-warning-primary pl-3 relative before:content-['⚠'] before:absolute before:left-0">
                Missing: {part}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasSuggestions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Try next:</p>
          <ul className="space-y-0.5">
            {metadata.suggestions!.map((suggestion, i) => (
              <li key={i} className="text-xs text-foreground/80 pl-3 relative before:content-['→'] before:absolute before:left-0 before:text-muted-foreground">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasAssumptions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Assumptions made:</p>
          <ul className="space-y-0.5">
            {metadata.assumptionsMade!.map((assumption, i) => (
              <li key={i} className="text-xs text-foreground/80 pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-muted-foreground">
                {assumption}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasQuestions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Open questions:</p>
          <ul className="space-y-0.5">
            {metadata.openQuestions!.map((question, i) => (
              <li key={i} className="text-xs text-foreground/80 pl-3 relative before:content-['?'] before:absolute before:left-0 before:text-primary">
                {question}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasVariants && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
          <span className="text-xs font-medium text-muted-foreground">Versions:</span>
          <Button
            type="button"
            variant={activeVariant === "original" ? "primary" : "secondary"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onVariantChange("original")}
          >
            Original
          </Button>
          {metadata.alternativeVersions!.shorter && (
            <Button
              type="button"
              variant={activeVariant === "shorter" ? "primary" : "secondary"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onVariantChange("shorter")}
            >
              Use shorter
            </Button>
          )}
          {metadata.alternativeVersions!.more_detailed && (
            <Button
              type="button"
              variant={activeVariant === "more_detailed" ? "primary" : "secondary"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onVariantChange("more_detailed")}
            >
              Use more detailed
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const marker = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
  const rowClass =
    line.type === "add"
      ? UI_STATUS_ROW_CLASSES.success
      : line.type === "remove"
        ? UI_STATUS_ROW_CLASSES.danger
        : "text-foreground";

  return (
    <div className={`px-3 whitespace-pre-wrap wrap-break-word ${rowClass}`}>
      <span className="inline-block w-4 select-none">{marker}</span>
      {line.value}
    </div>
  );
}
