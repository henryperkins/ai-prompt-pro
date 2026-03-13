import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card } from "@/components/base/card";
import { Button } from "@/components/base/buttons/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { copyTextToClipboard } from "@/lib/clipboard";
import { trackBuilderEvent } from "@/lib/telemetry";
import { buildLineDiff, buildTextEditMetrics } from "@/lib/text-diff";
import {
  buildClarificationBlock,
  formatClarificationQuestions,
  shouldShowClarificationCard,
} from "@/lib/enhance-ambiguity";
import {
  UI_STATUS_SURFACE_CLASSES,
  UI_STATUS_TEXT_CLASSES,
} from "@/lib/ui-status";
import { getOutputPanelReviewState } from "@/lib/output-panel-review-state";
import { cx } from "@/lib/utils/cx";
import { normalizeHttpUrl } from "@/lib/url-utils";
import { WebSearchActivityIndicator } from "@/components/WebSearchActivityIndicator";
import type { WebSearchActivity } from "@/lib/enhance-web-search-stream";
import type {
  EditableEnhancementListEdit,
  EditableEnhancementListField,
  EnhanceMetadata,
} from "@/lib/enhance-metadata";
import type { EnhanceWorkflowStep } from "@/lib/enhance-workflow";
import type { AmbiguityMode, EnhancementDepth, RewriteStrictness } from "@/lib/user-preferences";
import {
  OutputPanelSaveDialog,
  type SavePromptInput,
  type SaveAndSharePromptInput,
} from "@/components/OutputPanelSaveDialog";
import type {
  EnhancePhase,
  EnhancementVariant,
  OutputPreviewSource,
} from "@/components/output-panel-types";
import { OutputPanelHeader } from "@/components/OutputPanelHeader";
import { OutputPanelCompareDialog } from "@/components/OutputPanelCompareDialog";
import { OutputPanelDetailsAccordion } from "@/components/OutputPanelDetailsAccordion";
import { OutputPanelEnhancementSummary } from "@/components/OutputPanelEnhancementSummary";
import { OutputPanelEnhanceControls } from "@/components/OutputPanelEnhanceControls";
import { OutputPanelStateBanner } from "@/components/OutputPanelStateBanner";
import { OutputPanelWorkflow } from "@/components/OutputPanelWorkflow";
import { EnhancementInspector, type ApplyToBuilderUpdate } from "@/components/EnhancementInspector";
import { EnhancementClarificationCard } from "@/components/EnhancementClarificationCard";
import {
  Crosshair as Target,
  DotsThreeOutline as MoreHorizontal,
  FloppyDisk as Save,
} from "@phosphor-icons/react";

export type { EnhancePhase, OutputPreviewSource, EnhancementVariant };
export type { SavePromptInput, SaveAndSharePromptInput };
const REASONING_SUMMARY_FADE_MS = 900;

interface OutputPanelProps {
  builtPrompt: string;
  enhancedPrompt: string;
  isEnhancing: boolean;
  onEnhance: () => void;
  onSaveVersion: () => void;
  onSavePrompt: (input: SavePromptInput) => Promise<boolean>;
  onSaveAndSharePrompt: (input: SaveAndSharePromptInput) => Promise<boolean>;
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
  enhanceWorkflow?: EnhanceWorkflowStep[];
  previewSource?: OutputPreviewSource;
  hasEnhancedOnce?: boolean;
  enhanceMetadata?: EnhanceMetadata | null;
  activeVariant?: EnhancementVariant;
  onVariantChange?: (variant: EnhancementVariant) => void;
  onPromptAccepted?: (source: "copy") => void;
  enhancementDepth?: EnhancementDepth;
  rewriteStrictness?: RewriteStrictness;
  onEnhancementDepthChange?: (depth: EnhancementDepth) => void;
  onRewriteStrictnessChange?: (strictness: RewriteStrictness) => void;
  ambiguityMode?: AmbiguityMode;
  onAmbiguityModeChange?: (mode: AmbiguityMode) => void;
  enhancementSettingsSummary?: string;
  onEditEnhancementSettings?: () => void;
  onApplyToBuilder?: (updates: ApplyToBuilderUpdate) => void;
  onAppendClarificationBlockToPrompt?: (block: string) => void;
  onAppendToSessionContext?: (content: string) => void;
  onEditableListSaved?: (edit: EditableEnhancementListEdit) => void;
  onApplyEditableListToPrompt?: (
    field: EditableEnhancementListField,
    items: string[],
  ) => void;
  staleEnhancementNotice?: string | null;
  /** Archived artifacts from the last settled enhancement, available in stale state only. */
  archivedEnhanceMetadata?: EnhanceMetadata | null;
  archivedReasoningSummary?: string;
  archivedEnhanceWorkflow?: EnhanceWorkflowStep[];
  archivedWebSearchSources?: string[];
  /** When false, the structured inspector and apply-to-builder actions are hidden. */
  showStructuredInspector?: boolean;
  announceStatus?: boolean;
}

export type { ApplyToBuilderUpdate };

function getEditableListActionCopy(field: EditableEnhancementListField): {
  title: string;
  description: string;
} {
  if (field === "open_questions" || field === "plan_open_questions") {
    return {
      title: "Questions added to prompt",
      description: "The builder prompt now includes the edited clarification questions.",
    };
  }

  return {
    title: "Assumptions added to prompt",
    description: "The builder prompt now includes the edited assumptions and corrections.",
  };
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
  webSearchActivity,
  reasoningSummary = "",
  enhanceWorkflow = [],
  previewSource,
  hasEnhancedOnce = true,
  enhanceMetadata,
  activeVariant,
  onVariantChange,
  onPromptAccepted,
  enhancementDepth = "guided",
  rewriteStrictness = "balanced",
  onEnhancementDepthChange,
  onRewriteStrictnessChange,
  ambiguityMode = "infer_conservatively",
  onAmbiguityModeChange,
  enhancementSettingsSummary,
  onEditEnhancementSettings,
  onApplyToBuilder,
  onAppendClarificationBlockToPrompt,
  onAppendToSessionContext,
  onEditableListSaved,
  onApplyEditableListToPrompt,
  staleEnhancementNotice,
  archivedEnhanceMetadata,
  archivedReasoningSummary = "",
  archivedEnhanceWorkflow = [],
  archivedWebSearchSources = [],
  showStructuredInspector = true,
  announceStatus = true,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogShareIntent, setSaveDialogShareIntent] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [internalActiveVariant, setInternalActiveVariant] = useState<EnhancementVariant>("original");
  const [isRunProgressOpen, setIsRunProgressOpen] = useState(
    () =>
      enhancePhase === "starting" ||
      enhancePhase === "streaming" ||
      enhancePhase === "settling",
  );

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

  const isTransientPhase =
    enhancePhase === "starting" ||
    enhancePhase === "streaming" ||
    enhancePhase === "settling";
  const isRunInFlight = isEnhancing || isTransientPhase;
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
  const hasPreviewContent = displayPrompt.trim().length > 0;
  const isStalePreview = Boolean(staleEnhancementNotice?.trim());
  // Gate on visible artifact + in-flight status, not enhancePhase alone.
  // This survives the done→idle timer so settled enhanced output keeps
  // ready semantics (compare, save, variants) after the phase returns to idle.
  const isSettledEnhancedOutput =
    !isRunInFlight &&
    effectivePreviewSource === "enhanced" &&
    hasPreviewContent &&
    !isStalePreview;
  const hasCompare = Boolean(
    builtPrompt.trim() && displayPrompt.trim() && builtPrompt.trim() !== displayPrompt.trim()
  );
  const canShowCompare = hasCompare && isSettledEnhancedOutput;
  const canShowTooMuchChanged = canShowCompare && hasEnhancedOnce;
  const copyLabel =
    isTransientPhase || isSettledEnhancedOutput
      ? "Copy current output"
      : "Copy draft";
  const showUtilityActions = hasPreviewContent;
  const canUseSaveMenu =
    !isTransientPhase && (canSavePrompt || canSharePrompt || hasPreviewContent);
  const canUseMoreMenu = !isTransientPhase && showUtilityActions;
  const editMetrics = useMemo(
    () => buildTextEditMetrics(builtPrompt, displayPrompt),
    [builtPrompt, displayPrompt],
  );
  // Clarification actions only apply to the current (non-archived) enhancement.
  const showClarificationActions = shouldShowClarificationCard(
    enhanceMetadata,
    ambiguityMode,
  );

  // In stale state, fall back to archived artifacts for secondary disclosures.
  // Primary preview/actions always use current (non-archived) values.
  const detailMetadata = enhanceMetadata ?? (isStalePreview ? (archivedEnhanceMetadata ?? null) : null);
  const detailWorkflow = enhanceWorkflow.length > 0
    ? enhanceWorkflow
    : isStalePreview ? archivedEnhanceWorkflow : [];
  const detailReasoningSummary = displayedReasoningSummary
    || (isStalePreview ? archivedReasoningSummary.trim() : "");
  const detailWebSearchSources = webSearchSources.length > 0
    ? webSearchSources
    : isStalePreview ? archivedWebSearchSources : [];

  const hasStructuredInspectorContent = Boolean(
    detailMetadata?.partsBreakdown ||
    detailMetadata?.enhancementPlan ||
    (detailMetadata?.assumptionsMade?.length ?? 0) > 0 ||
    (detailMetadata?.openQuestions?.length ?? 0) > 0,
  );
  const availableVariants = useMemo(() => {
    const variants: EnhancementVariant[] = ["original"];
    if (enhanceMetadata?.alternativeVersions?.shorter) {
      variants.push("shorter");
    }
    if (enhanceMetadata?.alternativeVersions?.more_detailed) {
      variants.push("more_detailed");
    }
    return variants;
  }, [enhanceMetadata]);
  const showVariantSwitches =
    isSettledEnhancedOutput && availableVariants.length > 1;
  const hasRunProgress = Boolean(
    detailReasoningSummary ||
      (webSearchActivity && webSearchActivity.phase !== "idle") ||
      detailWorkflow.length > 0,
  );
  const runProgressSummary = [
    detailWorkflow.length > 0
      ? `${detailWorkflow.length} workflow step${detailWorkflow.length === 1 ? "" : "s"}`
      : null,
    webSearchActivity && webSearchActivity.phase !== "idle"
      ? webSearchActivity.phase === "searching"
        ? "live web search"
        : `${webSearchActivity.searchCount} search${webSearchActivity.searchCount === 1 ? "" : "es"}`
      : null,
    detailReasoningSummary ? "reasoning summary" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  const hasEnhancementSummary = Boolean(detailMetadata && !isEnhancing);
  const hasInspectorPanel = Boolean(
    showStructuredInspector &&
      detailMetadata &&
      !isEnhancing &&
      hasStructuredInspectorContent,
  );
  const hasSourcesPanel = detailWebSearchSources.length > 0;
  const shouldAutoOpenEnhancementDetails =
    showClarificationActions || Boolean(enhanceMetadata?.missingParts?.length);
  const reviewState = getOutputPanelReviewState({
    enhancePhase,
    isEnhancing,
    previewSource: effectivePreviewSource,
    hasPreviewContent,
    staleEnhancementNotice,
  });

  useEffect(() => {
    if (!canShowCompare && compareDialogOpen) {
      setCompareDialogOpen(false);
    }
  }, [canShowCompare, compareDialogOpen]);

  useEffect(() => {
    if (isTransientPhase) {
      setIsRunProgressOpen(true);
      return;
    }

    if (!hasRunProgress) {
      setIsRunProgressOpen(false);
    }
  }, [hasRunProgress, isTransientPhase]);

  const diff = useMemo(() => {
    if (!compareDialogOpen || !canShowCompare) return null;
    return buildLineDiff(builtPrompt, displayPrompt);
  }, [compareDialogOpen, canShowCompare, builtPrompt, displayPrompt]);

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
      if (hasEnhancedOnce) {
        onPromptAccepted?.("copy");
      }
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

  const handleCopyText = async (label: string, content: string) => {
    if (!content.trim()) return;
    try {
      await copyTextToClipboard(content);
      toast({
        title: `${label} copied`,
        description: "The copied text is ready to paste elsewhere.",
      });
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

  const handleTooMuchChanged = () => {
    trackBuilderEvent("builder_enhance_too_much_changed", {
      variant: resolvedActiveVariant,
      promptChars: displayPrompt.length,
      originalPromptChars: builtPrompt.length,
      editDistance: editMetrics.editDistance,
      editDistanceRatio: editMetrics.editDistanceRatio,
      editDistanceBaseline: "builder_preview",
    });
    toast({
      title: "Feedback captured",
      description: "We marked this enhancement as too far from your original prompt.",
    });
  };

  const handleAppendClarificationToPrompt = () => {
    const block = buildClarificationBlock(enhanceMetadata?.openQuestions);
    if (!block || !onAppendClarificationBlockToPrompt) return;
    onAppendClarificationBlockToPrompt?.(block);
    toast({
      title: "Questions added to prompt",
      description: "The builder prompt now includes the clarification questions.",
    });
  };

  const handleAppendClarificationToSessionContext = () => {
    const block = buildClarificationBlock(enhanceMetadata?.openQuestions);
    if (!block || !onAppendToSessionContext) return;
    onAppendToSessionContext?.(block);
    toast({
      title: "Added to session context",
      description: "The clarification block was appended to the Codex carry-forward context.",
    });
  };

  return (
    <div className="ui-density min-w-0 space-y-4 h-full flex flex-col" data-density="comfortable">
      {announceStatus ? (
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {reviewState.assistiveStatus}
        </p>
      ) : null}
      <OutputPanelStateBanner
        title={reviewState.title}
        description={reviewState.description}
        previewSourceLabel={previewSourceLabel}
        statusLabel={isTransientPhase || isSettledEnhancedOutput ? statusLabel : null}
        nextAction={reviewState.nextAction}
        tone={reviewState.tone}
        stateKey={reviewState.stateKey}
      />

      <OutputPanelCompareDialog
        open={canShowCompare && compareDialogOpen}
        onOpenChange={setCompareDialogOpen}
        diff={diff}
        hasCompare={canShowCompare}
      />

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

      <Card
        className={cx(
          "enhance-output-frame flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
          isStreamingVisual && "enhance-output-streaming",
          isSettledVisual && "enhance-output-complete"
        )}
        data-testid="output-panel-preview-card"
      >
        <div className="border-b border-border/60 px-4 py-3">
          <p className="ui-section-label text-muted-foreground">
            Current preview
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {displayPrompt ? (
            <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
              {displayPrompt}
            </pre>
          ) : (
            <div className="flex h-full min-h-30 flex-col items-center justify-center gap-3 px-4 sm:min-h-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/30">
                <Target className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium text-foreground">
                  Your prompt preview appears here
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Start by describing what the model should do, then enhance to get a polished, structured prompt.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {showUtilityActions ? (
        <OutputPanelHeader
          copyLabel={copyLabel}
          hasCompare={canShowCompare}
          showTooMuchChanged={canShowTooMuchChanged}
          showUtilityActions={showUtilityActions}
          canUseSaveMenu={canUseSaveMenu}
          canUseMoreMenu={canUseMoreMenu}
          canSavePrompt={canSavePrompt}
          canSharePrompt={canSharePrompt}
          phase2Enabled={phase2Enabled}
          copied={copied}
          isMobile={isMobile}
          displayPrompt={displayPrompt}
          activeVariant={resolvedActiveVariant}
          availableVariants={showVariantSwitches ? availableVariants : ["original"]}
          onCopy={() => void handleCopy()}
          onOpenCompare={() => setCompareDialogOpen(true)}
          onTooMuchChanged={handleTooMuchChanged}
          onOpenSaveDialog={openSaveDialog}
          onSaveVersion={onSaveVersion}
          onVariantChange={showVariantSwitches ? handleVariantChange : undefined}
        />
      ) : (
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
              disabled
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
              disabled
              title="Enter a prompt to unlock options"
            >
              <MoreHorizontal className="w-3 h-3" />
              More
            </Button>
          </div>
        </div>
      )}

      {hideEnhanceButton &&
        (enhancementSettingsSummary || onEditEnhancementSettings) && (
          <div
            className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2"
            data-testid="output-panel-enhancement-settings-summary"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="ui-section-label text-muted-foreground">
                  Enhancement settings
                </p>
                {enhancementSettingsSummary && (
                  <p
                    className="text-sm text-foreground"
                    title={enhancementSettingsSummary}
                  >
                    {enhancementSettingsSummary}
                  </p>
                )}
              </div>
              {onEditEnhancementSettings && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onEditEnhancementSettings}
                  data-testid="output-panel-edit-enhancement-settings"
                >
                  Edit settings
                </Button>
              )}
            </div>
          </div>
        )}

      {showClarificationActions && enhanceMetadata?.openQuestions && (
        <EnhancementClarificationCard
          questions={enhanceMetadata.openQuestions}
          compact
          onAddToPrompt={handleAppendClarificationToPrompt}
          onAddToSessionContext={
            onAppendToSessionContext
              ? handleAppendClarificationToSessionContext
              : undefined
          }
          onCopyQuestions={() =>
            void handleCopyText(
              "Clarification questions",
              formatClarificationQuestions(enhanceMetadata.openQuestions),
            )
          }
        />
      )}

      {hasRunProgress ? (
        <OutputPanelDetailsAccordion
          title="Run progress"
          summary={runProgressSummary || "Workflow and search activity"}
          open={isRunProgressOpen}
          onOpenChange={setIsRunProgressOpen}
          testId="output-panel-details-run-progress"
        >
          {webSearchActivity && webSearchActivity.phase !== "idle" ? (
            <WebSearchActivityIndicator
              phase={webSearchActivity.phase}
              query={webSearchActivity.query}
              searchCount={webSearchActivity.searchCount}
            />
          ) : null}

          <OutputPanelWorkflow
            steps={detailWorkflow}
            isEnhancing={isEnhancing}
          />

          {detailReasoningSummary ? (
            <Card
              className={cx(
                "p-3 transition-opacity duration-1000 ease-out",
                UI_STATUS_SURFACE_CLASSES.warning,
                !isStalePreview && isReasoningSummaryFading && "opacity-0",
              )}
            >
              <p className={cx("ui-section-label", UI_STATUS_TEXT_CLASSES.warning)}>
                {isStalePreview ? "Archived reasoning summary" : "Reasoning summary"}
              </p>
              <div className="scrollbar-themed mt-2 max-h-36 overflow-y-auto overscroll-contain prose prose-sm max-w-none whitespace-normal text-foreground/90 dark:prose-invert prose-headings:my-1 prose-p:my-1 prose-pre:my-1 prose-code:wrap-break-word prose-ul:my-1 prose-ol:my-1 sm:max-h-56">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {detailReasoningSummary}
                </ReactMarkdown>
              </div>
            </Card>
          ) : null}
        </OutputPanelDetailsAccordion>
      ) : null}

      {hasEnhancementSummary ? (
        <OutputPanelDetailsAccordion
          title={isStalePreview ? "Last enhancement details" : "What the enhancer found"}
          summary={
            isStalePreview
              ? "Archived AI notes and detected context from the last settled run."
              : "AI assessment, detected intent, and suggested next steps."
          }
          defaultOpen={shouldAutoOpenEnhancementDetails}
          testId="output-panel-details-enhancer-findings"
        >
          <OutputPanelEnhancementSummary
            metadata={detailMetadata!}
            activeVariant={resolvedActiveVariant}
            onVariantChange={handleVariantChange}
            collapseOpenQuestions={false}
            showQualityScore={!isStalePreview}
            showVariants={false}
          />
        </OutputPanelDetailsAccordion>
      ) : null}

      {hasInspectorPanel ? (
        <OutputPanelDetailsAccordion
          title="Inspector: assumptions, gaps, and builder updates"
          summary={
            isStalePreview
              ? "Archived structured edits from the last enhancement run."
              : "Apply structured findings back into the builder when they help."
          }
          defaultOpen={shouldAutoOpenEnhancementDetails}
          testId="output-panel-details-inspector"
        >
          <EnhancementInspector
            metadata={detailMetadata!}
            onApplyToBuilder={isStalePreview ? undefined : onApplyToBuilder}
            onApplyToSessionContext={
              isStalePreview || !onAppendToSessionContext
                ? undefined
                : (label, content) => {
                  onAppendToSessionContext(content);
                  toast({
                    title: `${label} added`,
                    description:
                      "That plan detail was appended to the session context.",
                  });
                }
            }
            onCopyText={(label, content) => {
              void handleCopyText(label, content);
            }}
            onEditableListSaved={isStalePreview ? undefined : onEditableListSaved}
            onApplyEditableListToPrompt={isStalePreview ? undefined : (field, items) => {
              if (!onApplyEditableListToPrompt) return;
              onApplyEditableListToPrompt(field, items);
              const copy = getEditableListActionCopy(field);
              toast(copy);
            }}
          />
        </OutputPanelDetailsAccordion>
      ) : null}

      {hasSourcesPanel ? (
        <OutputPanelDetailsAccordion
          title={isStalePreview ? "Archived sources" : "Sources and provenance"}
          summary={`${detailWebSearchSources.length} source link${detailWebSearchSources.length === 1 ? "" : "s"}`}
          testId="output-panel-details-sources"
        >
          <ul className="space-y-1">
            {detailWebSearchSources.map((source, i) => {
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
        </OutputPanelDetailsAccordion>
      ) : null}

      {!hideEnhanceButton && (
        <OutputPanelEnhanceControls
          webSearchEnabled={webSearchEnabled}
          onWebSearchToggle={onWebSearchToggle}
          isEnhancing={isEnhancing}
          enhancementDepth={enhancementDepth}
          rewriteStrictness={rewriteStrictness}
          ambiguityMode={ambiguityMode}
          onEnhancementDepthChange={onEnhancementDepthChange}
          onRewriteStrictnessChange={onRewriteStrictnessChange}
          onAmbiguityModeChange={onAmbiguityModeChange}
          onEnhance={onEnhance}
          builtPrompt={builtPrompt}
          enhancePhase={enhancePhase}
          enhanceLabel={enhanceLabel}
        />
      )}
    </div>
  );
}
