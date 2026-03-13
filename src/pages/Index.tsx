import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { BuilderHeroInput } from "@/components/BuilderHeroInput";
import { BuilderAdjustDetails } from "@/components/BuilderAdjustDetails";
import { BuilderSourcesAdvanced } from "@/components/BuilderSourcesAdvanced";
import { CodexSessionDrawer } from "@/components/CodexSessionDrawer";
import { MobileEnhancementSettingsSheet } from "@/components/MobileEnhancementSettingsSheet";
import {
  OutputPanel,
  type EnhancePhase,
  type EnhancementVariant,
  type OutputPreviewSource,
  type ApplyToBuilderUpdate,
} from "@/components/OutputPanel";
import { EnhancePrimaryButton } from "@/components/OutputPanelEnhanceControls";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import {
  inferBuilderFields,
  isAIClientError,
  streamEnhance,
  type AIClientError,
  type EnhanceThreadOptions,
} from "@/lib/ai-client";
import { buildEnhanceContextSources } from "@/lib/enhance-context-sources";
import { createCodexSession, type CodexSession } from "@/lib/codex-session";
import {
  applyInferenceUpdates,
  clearAiOwnedFields,
  createFieldOwnershipFromConfig,
  inferBuilderFieldsLocally,
  listInferenceFieldsFromUpdates,
  markOwnershipFields,
  type BuilderInferenceRequestContext,
  type BuilderFieldOwnershipMap,
  type BuilderSuggestionChip,
} from "@/lib/builder-inference";
import { getSectionHealth } from "@/lib/section-health";
import {
  buildPromptConfigSignature,
  buildPrompt,
  defaultConfig,
  hasBuilderFieldInput,
  hasPromptInput,
  normalizeConstraintSelections,
  partitionConstraintText,
  reconcileFormatLength,
  scorePrompt,
} from "@/lib/prompt-builder";
import {
  applyEnhanceOutputEvent,
  createEnhanceOutputStreamState,
} from "@/lib/enhance-output-stream";
import {
  extractCodexDeltaText,
  extractCodexReasoningText,
  hasCodexReasoningSegment,
  isCodexReasoningItemType,
  normalizeCodexToken,
  type CodexStreamEventMeta,
} from "@/lib/codex-stream";
import {
  extractWebSearchActivity,
  IDLE_WEB_SEARCH_ACTIVITY,
  type WebSearchActivity,
} from "@/lib/enhance-web-search-stream";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { loadPost, loadProfilesByIds } from "@/lib/community";
import { consumeRestoredVersionPrompt } from "@/lib/history-restore";
import {
  recordEnhancementAction,
  loadEnhancementProfile,
  getMostUsedPreference,
  resetEnhancementProfile,
} from "@/lib/prompt-enhancement-profile";
import { trackBuilderEvent } from "@/lib/telemetry";
import {
  parseEnhanceMetadata,
  type EditableEnhancementListEdit,
  type EditableEnhancementListField,
  type EnhanceMetadata,
} from "@/lib/enhance-metadata";
import {
  parseEnhanceWorkflowStep,
  upsertEnhanceWorkflowStep,
  type EnhanceWorkflowStep,
} from "@/lib/enhance-workflow";
import {
  detectDraftIntent,
  isIntentRoute,
  type IntentRoute,
} from "@/lib/enhance-intent";
import { templates } from "@/lib/templates";
import {
  getUserPreferences,
  setUserPreference,
  type AmbiguityMode,
  type EnhancementDepth,
  type RewriteStrictness,
} from "@/lib/user-preferences";
import {
  appendTextBlock,
  buildAssumptionsCorrectionBlock,
  buildClarificationBlock,
} from "@/lib/enhance-ambiguity";
import { getEnhancementSettingsSummary } from "@/lib/enhancement-settings";
import { getOutputPanelReviewState } from "@/lib/output-panel-review-state";
import { buildTextEditMetrics } from "@/lib/text-diff";
import { brandCopy } from "@/lib/brand-copy";
import {
  getHeroCopyVariant,
  getLaunchExperimentAssignments,
} from "@/lib/launch-experiments";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/base/drawer";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Card } from "@/components/base/card";
import { ToastAction } from "@/components/base/toast";
import { PFQualityGauge } from "@/components/fantasy/PFQualityGauge";
import {
  CaretRight,
  Crosshair as Target,
  Eye,
  Sliders as SlidersHorizontal,
  Sparkle as Sparkles,
  X,
} from "@phosphor-icons/react";

type BuilderSection = "builder" | "context" | "tone" | "quality";

const ENHANCE_THREAD_OPTIONS_BASE: Omit<
  EnhanceThreadOptions,
  "webSearchEnabled"
> = {
  modelReasoningEffort: "xhigh",
};

const DEBUG_ENHANCE_EVENTS_KEY = "promptforge:debug-enhance-events";
const DEBUG_ENHANCE_EVENTS_MAX = 200;
const DEBUG_ENHANCE_PAYLOAD_PREVIEW_CHARS = 1200;
const LIVE_GENERATE_PROMPT_DETAIL_MAX_CHARS = 240;
const ENHANCED_PROMPT_SOURCES_SEPARATOR = /\n---\n\s*Sources:\s*\n/i;
const ENHANCED_PROMPT_JSON_ARTIFACT_PATTERN = /"enhanced_prompt"\s*:/i;
const ENHANCED_PROMPT_CODE_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;
const DEFAULT_BUILDER_SIGNATURE = buildPromptConfigSignature(defaultConfig);
const DEFAULT_ENHANCEMENT_DEPTH: EnhancementDepth = "guided";
const DEFAULT_REWRITE_STRICTNESS: RewriteStrictness = "balanced";
const DEFAULT_AMBIGUITY_MODE: AmbiguityMode = "infer_conservatively";
const BUILDER_INFERENCE_RETRY_BASE_MS = 10_000;
const BUILDER_INFERENCE_RETRY_MAX_MS = 40_000;
const BUILDER_INFERENCE_FALLBACK_MESSAGE =
  "Using local suggestions while AI suggestions reconnect. We'll retry automatically.";
const BUILDER_INFERENCE_RETRYING_MESSAGE =
  "AI suggestions are unavailable right now. Retrying automatically.";

type EnhanceStreamEvent = CodexStreamEventMeta & {
  payload: unknown;
};

type EnhanceDebugEventSnapshot = {
  at: number;
  eventType: string | null;
  responseType: string | null;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  itemType: string | null;
  payloadPreview: string;
};

function getBuilderInferenceFallbackMessage(
  hasLocalFallbackSuggestions: boolean,
): string {
  return hasLocalFallbackSuggestions
    ? BUILDER_INFERENCE_FALLBACK_MESSAGE
    : BUILDER_INFERENCE_RETRYING_MESSAGE;
}

function isReasoningSummaryEvent(
  meta: EnhanceStreamEvent,
  payload: unknown,
): boolean {
  if (isCodexReasoningItemType(meta.itemType)) return true;

  if (hasCodexReasoningSegment(meta.eventType)) return true;

  if (hasCodexReasoningSegment(meta.responseType)) return true;

  if (payload && typeof payload === "object") {
    const payloadItemType = (payload as { item?: { type?: unknown } }).item
      ?.type;
    if (
      isCodexReasoningItemType(
        typeof payloadItemType === "string" ? payloadItemType : null,
      )
    )
      return true;
  }

  return false;
}

function hasDeltaFieldValue(value: unknown): boolean {
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === "object");
}

function hasExplicitReasoningDelta(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as {
    delta?: unknown;
    item?: { delta?: unknown } | null;
    payload?: { delta?: unknown } | null;
  };
  return (
    hasDeltaFieldValue(data.delta) ||
    hasDeltaFieldValue(data.item?.delta) ||
    hasDeltaFieldValue(data.payload?.delta)
  );
}

function extractReasoningSummaryChunk(
  meta: EnhanceStreamEvent,
  payload: unknown,
): { text: string; isDelta: boolean; itemId: string | null } | null {
  if (!isReasoningSummaryEvent(meta, payload)) return null;
  const eventToken = `${normalizeCodexToken(meta.eventType)} ${normalizeCodexToken(meta.responseType)}`;
  const isDeltaEvent = eventToken.includes("delta");
  const hasExplicitDelta = hasExplicitReasoningDelta(payload);
  if (isDeltaEvent || hasExplicitDelta) {
    const deltaText = extractCodexDeltaText(payload);
    if (deltaText)
      return { text: deltaText, isDelta: true, itemId: meta.itemId };
  }

  const directText = extractCodexReasoningText(payload);

  if (!directText) return null;

  return { text: directText, isDelta: isDeltaEvent, itemId: meta.itemId };
}

function stripJsonCodeFence(text: string): string {
  const fenced = text.match(ENHANCED_PROMPT_CODE_FENCE_PATTERN);
  if (!fenced) return text;
  return fenced[1]?.trim() ?? "";
}

function extractJsonObjectCandidate(text: string): string | null {
  const normalized = stripJsonCodeFence(text).trim();
  if (!normalized) return null;
  if (normalized.startsWith("{") && normalized.endsWith("}")) return normalized;
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return normalized.slice(start, end + 1);
}

function extractEnhancedPromptFromJsonArtifact(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) return null;
  if (!ENHANCED_PROMPT_JSON_ARTIFACT_PATTERN.test(normalized)) return null;

  const candidate = extractJsonObjectCandidate(normalized);
  if (!candidate) return null;

  try {
    const parsed = JSON.parse(candidate) as { enhanced_prompt?: unknown };
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    if (typeof parsed.enhanced_prompt !== "string") return null;
    const enhancedPrompt = parsed.enhanced_prompt.trim();
    return enhancedPrompt || null;
  } catch {
    return null;
  }
}

function formatLiveGeneratePromptWorkflowDetail(text: string): string {
  const normalized = splitEnhancedPromptAndSources(
    extractEnhancedPromptFromJsonArtifact(text) ?? text,
  ).promptText
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  if (normalized.length <= LIVE_GENERATE_PROMPT_DETAIL_MAX_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, LIVE_GENERATE_PROMPT_DETAIL_MAX_CHARS - 3).trimEnd()}...`;
}

function splitEnhancedPromptAndSources(input: string): {
  promptText: string;
  sources: string[];
} {
  const normalizedInput = extractEnhancedPromptFromJsonArtifact(input) ?? input;
  const separatorIdx = normalizedInput.search(
    ENHANCED_PROMPT_SOURCES_SEPARATOR,
  );
  if (separatorIdx === -1) {
    return {
      promptText: normalizedInput,
      sources: [],
    };
  }

  const promptText = normalizedInput.slice(0, separatorIdx).trimEnd();
  const sourcesBlock = normalizedInput.slice(separatorIdx);
  const sources = sourcesBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));

  return {
    promptText,
    sources,
  };
}

function shouldPreferMetadataPrompt(
  currentOutput: string,
  metadataPrompt: string,
): boolean {
  const normalizedCurrent = currentOutput.trim();
  const normalizedMetadata = metadataPrompt.trim();
  if (!normalizedMetadata) return false;
  if (!normalizedCurrent) return true;
  if (normalizedCurrent === normalizedMetadata) return false;

  return Boolean(extractEnhancedPromptFromJsonArtifact(normalizedCurrent));
}

function extractEnhancedPromptFromMetadataEvent(
  payload: unknown,
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    event?: unknown;
    type?: unknown;
    payload?: unknown;
  };
  const eventType = normalizeCodexToken(
    typeof data.event === "string" ? data.event : null,
  );
  const responseType = normalizeCodexToken(
    typeof data.type === "string" ? data.type : null,
  );
  if (eventType !== "enhance/metadata" && responseType !== "enhance.metadata")
    return null;

  const metadata = data.payload;
  if (!metadata || typeof metadata !== "object") return null;

  const enhancedPrompt = (metadata as { enhanced_prompt?: unknown })
    .enhanced_prompt;
  if (typeof enhancedPrompt !== "string") return null;
  const normalized = enhancedPrompt.trim();
  return normalized || null;
}

function previewEnhancePayload(payload: unknown): string {
  if (payload === null || payload === undefined) return "";
  try {
    const serialized = JSON.stringify(payload);
    if (!serialized) return "";
    if (serialized.length <= DEBUG_ENHANCE_PAYLOAD_PREVIEW_CHARS)
      return serialized;
    return `${serialized.slice(0, DEBUG_ENHANCE_PAYLOAD_PREVIEW_CHARS)}...`;
  } catch {
    return "[unserializable payload]";
  }
}

function toEnhanceDebugEventSnapshot(
  event: EnhanceStreamEvent,
): EnhanceDebugEventSnapshot {
  return {
    at: Date.now(),
    eventType: event.eventType,
    responseType: event.responseType,
    threadId: event.threadId,
    turnId: event.turnId,
    itemId: event.itemId,
    itemType: event.itemType,
    payloadPreview: previewEnhancePayload(event.payload),
  };
}

function isEnhanceDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEBUG_ENHANCE_EVENTS_KEY) === "1";
  } catch {
    return false;
  }
}

function hasEnhancementProfileData(profile: ReturnType<typeof loadEnhancementProfile>): boolean {
  return (
    profile.totalEnhancements > 0 ||
    profile.acceptCount > 0 ||
    profile.rerunCount > 0 ||
    Object.keys(profile.depthCounts).length > 0 ||
    Object.keys(profile.strictnessCounts).length > 0 ||
    Object.keys(profile.ambiguityModeCounts).length > 0 ||
    Object.keys(profile.variantCounts).length > 0 ||
    Object.keys(profile.intentOverrideCounts).length > 0 ||
    Object.keys(profile.assumptionEditCounts).length > 0 ||
    Object.keys(profile.formatCounts).length > 0 ||
    Object.keys(profile.structuredApplyCounts).length > 0
  );
}

function hasFieldOwnershipValue(
  ownership: BuilderFieldOwnershipMap,
  value: "ai" | "user" | "empty",
): boolean {
  return Object.values(ownership).some((entry) => entry === value);
}

function normalizeRemoteInferenceResult(
  response: Awaited<ReturnType<typeof inferBuilderFields>>,
): ReturnType<typeof inferBuilderFieldsLocally> {
  const inferredUpdatesRaw = response.inferredUpdates;
  const inferredFieldsRaw = response.inferredFields;
  const suggestionChipsRaw = response.suggestionChips;

  const inferredUpdates: {
    role?: string;
    tone?: string;
    lengthPreference?: string;
    format?: string[];
    constraints?: string[];
  } = {};
  if (typeof inferredUpdatesRaw?.role === "string") {
    inferredUpdates.role = inferredUpdatesRaw.role;
  }
  if (typeof inferredUpdatesRaw?.tone === "string") {
    inferredUpdates.tone = inferredUpdatesRaw.tone;
  }
  if (typeof inferredUpdatesRaw?.lengthPreference === "string") {
    inferredUpdates.lengthPreference = inferredUpdatesRaw.lengthPreference;
  }
  if (Array.isArray(inferredUpdatesRaw?.format)) {
    inferredUpdates.format = inferredUpdatesRaw.format.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }
  if (Array.isArray(inferredUpdatesRaw?.constraints)) {
    inferredUpdates.constraints = normalizeConstraintSelections(
      inferredUpdatesRaw.constraints.filter(
        (entry): entry is string => typeof entry === "string",
      ),
    );
  }

  const inferredFields = Array.isArray(inferredFieldsRaw)
    ? inferredFieldsRaw.filter(
      (
        field,
      ): field is
        | "role"
        | "tone"
        | "lengthPreference"
        | "format"
        | "constraints" =>
        field === "role" ||
        field === "tone" ||
        field === "lengthPreference" ||
        field === "format" ||
        field === "constraints",
    )
    : [];
  if (inferredFields.length === 0) {
    if (typeof inferredUpdates.role === "string") inferredFields.push("role");
    if (typeof inferredUpdates.tone === "string") inferredFields.push("tone");
    if (typeof inferredUpdates.lengthPreference === "string")
      inferredFields.push("lengthPreference");
    if (Array.isArray(inferredUpdates.format)) inferredFields.push("format");
    if (Array.isArray(inferredUpdates.constraints))
      inferredFields.push("constraints");
  }

  const suggestionChips = Array.isArray(suggestionChipsRaw)
    ? suggestionChipsRaw
      .map((chip): BuilderSuggestionChip | null => {
        if (!chip || typeof chip !== "object") return null;
        const id = typeof chip.id === "string" ? chip.id : null;
        const label = typeof chip.label === "string" ? chip.label : null;
        const description =
          typeof chip.description === "string" ? chip.description : "";
        const action = chip.action;
        if (!id || !label || !action || typeof action !== "object")
          return null;

        const actionType = action.type;
        if (
          actionType === "append_prompt" &&
          typeof action.text === "string"
        ) {
          return {
            id,
            label,
            description,
            action: {
              type: "append_prompt",
              text: action.text,
            },
          };
        }

        if (
          actionType === "set_fields" &&
          action.updates &&
          typeof action.updates === "object"
        ) {
          const updates = action.updates as Record<string, unknown>;
          const fields = Array.isArray(action.fields)
            ? action.fields.filter(
              (
                field,
              ): field is
                | "role"
                | "tone"
                | "lengthPreference"
                | "format"
                | "constraints" =>
                field === "role" ||
                field === "tone" ||
                field === "lengthPreference" ||
                field === "format" ||
                field === "constraints",
            )
            : [];

          return {
            id,
            label,
            description,
            action: {
              type: "set_fields",
              updates: (() => {
                const normalizedUpdates: {
                  role?: string;
                  tone?: string;
                  lengthPreference?: string;
                  format?: string[];
                  constraints?: string[];
                  customRole?: string;
                  customFormat?: string;
                  customConstraint?: string;
                } = {};
                if (typeof updates.role === "string") {
                  normalizedUpdates.role = updates.role;
                  normalizedUpdates.customRole = "";
                }
                if (typeof updates.tone === "string") {
                  normalizedUpdates.tone = updates.tone;
                }
                if (typeof updates.lengthPreference === "string") {
                  normalizedUpdates.lengthPreference =
                    updates.lengthPreference;
                }
                if (Array.isArray(updates.format)) {
                  normalizedUpdates.format = updates.format.filter(
                    (entry): entry is string => typeof entry === "string",
                  );
                  normalizedUpdates.customFormat = "";
                }
                if (Array.isArray(updates.constraints)) {
                  normalizedUpdates.constraints =
                    normalizeConstraintSelections(
                      updates.constraints.filter(
                        (entry): entry is string => typeof entry === "string",
                      ),
                    );
                  normalizedUpdates.customConstraint = "";
                }
                return normalizedUpdates;
              })(),
              fields,
            },
          };
        }

        return null;
      })
      .filter((chip): chip is BuilderSuggestionChip => chip !== null)
    : [];

  return {
    inferredUpdates,
    inferredFields,
    suggestionChips,
    confidence: response.confidence,
  };
}

const buildInferenceCurrentFields = (config: typeof defaultConfig) => {
  const currentFields: {
    role?: string;
    tone?: string;
    lengthPreference?: string;
    format?: string[];
    constraints?: string[];
  } = {
    role: config.customRole.trim() || config.role.trim(),
    format: config.format,
    constraints: config.constraints,
  };

  if (config.tone && config.tone !== defaultConfig.tone) {
    currentFields.tone = config.tone;
  }
  if (
    config.lengthPreference &&
    config.lengthPreference !== defaultConfig.lengthPreference
  ) {
    currentFields.lengthPreference = config.lengthPreference;
  }

  return currentFields;
};

type EnhanceInputSnapshot = {
  runId: string;
  inputPromptText: string;
  inputPromptChars: number;
  inputWordCount: number;
  ambiguityLevel: string | null;
  isVaguePrompt: boolean;
  selectedVariant: EnhancementVariant;
};

type EnhanceMeasurementInput = Pick<
  EnhanceInputSnapshot,
  | "inputPromptText"
  | "inputPromptChars"
  | "inputWordCount"
  | "ambiguityLevel"
  | "isVaguePrompt"
>;

function countPromptWords(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

function isVaguePrompt(
  inputWordCount: number,
  ambiguityLevel: string | null | undefined,
): boolean {
  return inputWordCount < 20 || ambiguityLevel === "high";
}

function buildEnhanceRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEnhanceInputSnapshot(
  runId: string,
  inputPromptText: string,
  selectedVariant: EnhancementVariant,
  ambiguityLevel: string | null = null,
): EnhanceInputSnapshot {
  const trimmedInput = inputPromptText.trim();
  const inputWordCount = countPromptWords(trimmedInput);

  return {
    runId,
    inputPromptText: trimmedInput,
    inputPromptChars: trimmedInput.length,
    inputWordCount,
    ambiguityLevel,
    isVaguePrompt: isVaguePrompt(inputWordCount, ambiguityLevel),
    selectedVariant,
  };
}

function buildEnhanceMeasurementPayload(
  input: EnhanceMeasurementInput,
  outputText: string,
) {
  const editMetrics = buildTextEditMetrics(
    input.inputPromptText,
    outputText.trim(),
  );

  return {
    inputPromptChars: input.inputPromptChars,
    inputWordCount: input.inputWordCount,
    isVaguePrompt: input.isVaguePrompt,
    ambiguityLevel: input.ambiguityLevel,
    editDistance: editMetrics.editDistance,
    editDistanceRatio: editMetrics.editDistanceRatio,
    editDistanceBaseline: "enhance_input" as const,
  };
}

function extractSelectedOutputFormats(config: typeof defaultConfig): string[] {
  return [...config.format, config.customFormat.trim()].filter(
    (value) => value.length > 0,
  );
}

function looksLikePastedSourceMaterial(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 160) return false;

  return (
    trimmed.includes("```") ||
    trimmed.split("\n").length >= 4 ||
    /source material|transcript|excerpt|document|article|notes|brief/i.test(
      trimmed,
    )
  );
}

function buildInferenceRequestContext({
  config,
  enhanceSession,
  hasPresetOrRemix,
}: {
  config: typeof defaultConfig;
  enhanceSession: CodexSession;
  hasPresetOrRemix: boolean;
}): BuilderInferenceRequestContext {
  const attachedSourceCount = config.contextConfig.sources.length;
  const hasSessionContext = Boolean(
    enhanceSession.contextSummary.trim() ||
    enhanceSession.latestEnhancedPrompt.trim(),
  );
  const selectedOutputFormats = extractSelectedOutputFormats(config);
  const hasPastedSourceMaterial =
    looksLikePastedSourceMaterial(config.originalPrompt) ||
    looksLikePastedSourceMaterial(config.contextConfig.projectNotes);

  const requestContext: BuilderInferenceRequestContext = {
    hasAttachedSources: attachedSourceCount > 0,
    attachedSourceCount,
    hasSessionContext,
  };

  if (hasPresetOrRemix) {
    requestContext.hasPresetOrRemix = true;
  }
  if (selectedOutputFormats.length > 0) {
    requestContext.selectedOutputFormats = selectedOutputFormats;
  }
  if (hasPastedSourceMaterial) {
    requestContext.hasPastedSourceMaterial = true;
  }

  return requestContext;
}

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const remixId = searchParams.get("remix");
  const presetId = searchParams.get("preset");
  const remixLoadToken = useRef(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileEnhancementSettingsOpen, setMobileEnhancementSettingsOpen] =
    useState(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [heroCollapsed, setHeroCollapsed] = useState(() => {
    try {
      return localStorage.getItem("pf-hero-dismissed") === "1";
    } catch {
      return false;
    }
  });
  const [isAdjustDetailsOpen, setIsAdjustDetailsOpen] = useState(false);
  const [isSourcesAdvancedOpen, setIsSourcesAdvancedOpen] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(
    () => getUserPreferences().showAdvancedControls,
  );
  const [enhancementDepth, setEnhancementDepth] = useState<EnhancementDepth>(
    () => getUserPreferences().enhancementDepth,
  );
  const [rewriteStrictness, setRewriteStrictness] = useState<RewriteStrictness>(
    () => getUserPreferences().rewriteStrictness,
  );
  const [ambiguityMode, setAmbiguityMode] = useState<AmbiguityMode>(
    () => getUserPreferences().ambiguityMode,
  );
  const [enhancePhase, setEnhancePhase] = useState<EnhancePhase>("idle");
  const enhancePhaseTimers = useRef<number[]>([]);
  const hasTrackedBuilderLoaded = useRef(false);
  const hasTrackedFirstInput = useRef(false);
  const hasTrackedZone2Opened = useRef(false);
  const hasTrackedZone3Opened = useRef(false);
  const suggestionLoadToken = useRef(0);
  const builderInferenceRetryAt = useRef<number | null>(null);
  const builderInferenceRetryTimer = useRef<number | null>(null);
  const builderInferenceFailureCount = useRef(0);
  const enhanceStartedAt = useRef<number | null>(null);
  const enhancePending = useRef(false);
  const enhanceAbortController = useRef<AbortController | null>(null);
  const enhanceStreamToken = useRef(0);
  const activeEnhanceRunIdRef = useRef<string | null>(null);
  const acceptedRunIdsRef = useRef<Set<string>>(new Set());
  const lastEnhanceInputSnapshotRef = useRef<EnhanceInputSnapshot | null>(null);
  const activeEnhancementBuilderSignatureRef = useRef<string | null>(null);
  const [suggestionChips, setSuggestionChips] = useState<
    BuilderSuggestionChip[]
  >([]);
  const [isInferringSuggestions, setIsInferringSuggestions] = useState(false);
  const [hasInferenceError, setHasInferenceError] = useState(false);
  const [inferenceStatusMessage, setInferenceStatusMessage] = useState<
    string | null
  >(null);
  const [builderInferenceRetryNonce, setBuilderInferenceRetryNonce] =
    useState(0);
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    () => getUserPreferences().webSearchEnabled,
  );
  const [webSearchSources, setWebSearchSources] = useState<string[]>([]);
  const [webSearchActivity, setWebSearchActivity] = useState<WebSearchActivity>(
    IDLE_WEB_SEARCH_ACTIVITY,
  );
  const [reasoningSummary, setReasoningSummary] = useState("");
  const [enhanceMetadata, setEnhanceMetadata] = useState<EnhanceMetadata | null>(null);
  const [enhanceWorkflow, setEnhanceWorkflow] = useState<EnhanceWorkflowStep[]>([]);
  const [activeEnhancementVariant, setActiveEnhancementVariant] =
    useState<EnhancementVariant>("original");
  const [intentOverride, setIntentOverride] = useState<IntentRoute | null>(null);
  const [enhanceSession, setEnhanceSession] = useState<CodexSession>(() =>
    createCodexSession(),
  );
  const [fieldOwnership, setFieldOwnership] =
    useState<BuilderFieldOwnershipMap>(() =>
      createFieldOwnershipFromConfig(defaultConfig),
    );
  const [enhancementProfileSnapshot, setEnhancementProfileSnapshot] =
    useState(() => loadEnhancementProfile());
  const [
    lastSuccessfulEnhancementBuilderSignature,
    setLastSuccessfulEnhancementBuilderSignature,
  ] = useState<string | null>(null);
  const [
    lastEnhancementArtifactBuilderSignature,
    setLastEnhancementArtifactBuilderSignature,
  ] = useState<string | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const clearBuilderInferenceRetry = useCallback(() => {
    if (builderInferenceRetryTimer.current !== null) {
      window.clearTimeout(builderInferenceRetryTimer.current);
      builderInferenceRetryTimer.current = null;
    }
    builderInferenceRetryAt.current = null;
  }, []);

  const resetBuilderInferenceRetry = useCallback(() => {
    builderInferenceFailureCount.current = 0;
    clearBuilderInferenceRetry();
  }, [clearBuilderInferenceRetry]);

  const scheduleBuilderInferenceRetry = useCallback(
    (error: unknown) => {
      const nextFailureCount = builderInferenceFailureCount.current + 1;
      builderInferenceFailureCount.current = nextFailureCount;

      const retryAfterMs =
        isAIClientError(error) &&
          typeof error.retryAfterMs === "number" &&
          error.retryAfterMs > 0
          ? error.retryAfterMs
          : null;
      const exponentialBackoffMs = Math.min(
        BUILDER_INFERENCE_RETRY_BASE_MS *
          2 ** Math.max(0, nextFailureCount - 1),
        BUILDER_INFERENCE_RETRY_MAX_MS,
      );
      const retryDelayMs = Math.min(
        retryAfterMs ?? exponentialBackoffMs,
        BUILDER_INFERENCE_RETRY_MAX_MS,
      );

      clearBuilderInferenceRetry();
      builderInferenceRetryAt.current = Date.now() + retryDelayMs;
      builderInferenceRetryTimer.current = window.setTimeout(() => {
        builderInferenceRetryAt.current = null;
        builderInferenceRetryTimer.current = null;
        setBuilderInferenceRetryNonce((current) => current + 1);
      }, retryDelayMs);
    },
    [clearBuilderInferenceRetry],
  );

  useEffect(() => () => {
    clearBuilderInferenceRetry();
  }, [clearBuilderInferenceRetry]);

  const syncEnhancementProfile = useCallback(
    (action: Parameters<typeof recordEnhancementAction>[0]) => {
      recordEnhancementAction(action);
      setEnhancementProfileSnapshot(loadEnhancementProfile());
    },
    [],
  );

  const persistedSetWebSearchEnabled = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setWebSearchEnabled((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        setUserPreference("webSearchEnabled", next);
        return next;
      });
    },
    [],
  );

  const handleWebSearchToggle = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      persistedSetWebSearchEnabled(value);
    },
    [persistedSetWebSearchEnabled],
  );

  const persistedSetShowAdvancedControls = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setShowAdvancedControls((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        setUserPreference("showAdvancedControls", next);
        return next;
      });
    },
    [],
  );

  const {
    config,
    updateConfig,
    resetConfig,
    clearOriginalPrompt,
    builtPrompt,
    score,
    enhancedPrompt,
    setEnhancedPrompt,
    isEnhancing,
    setIsEnhancing,
    isSignedIn,
    saveVersion,
    savePrompt,
    saveAndSharePrompt,
    loadTemplate,
    remixContext,
    startRemix,
    clearRemix,
    updateContextSources,
    updateDatabaseConnections,
    updateRagParameters,
    updateContextStructured,
    updateContextInterview,
    updateProjectNotes,
    toggleDelimiters,
  } = usePromptBuilder();
  const builderSignature = useMemo(
    () => buildPromptConfigSignature(config),
    [config],
  );
  const canManageCodexSession = isSignedIn;

  const launchAssignments = useMemo(() => getLaunchExperimentAssignments(), []);
  const heroCopyVariant = launchAssignments.heroCopy;
  const heroCopy = useMemo(
    () => getHeroCopyVariant(heroCopyVariant),
    [heroCopyVariant],
  );
  const primaryCtaLabel = brandCopy.hero.primaryCta;

  const tipsWithOwnership = useMemo(
    () => scorePrompt(config, fieldOwnership).tips,
    [config, fieldOwnership],
  );

  const clearEnhanceTimers = useCallback(() => {
    enhancePhaseTimers.current.forEach((timer) => window.clearTimeout(timer));
    enhancePhaseTimers.current = [];
  }, []);

  const clearEnhanceOverrides = useCallback(() => {
    setIntentOverride(null);
    setActiveEnhancementVariant("original");
    setEnhanceMetadata(null);
  }, []);

  const resetEnhanceSessionState = useCallback(() => {
    clearEnhanceTimers();
    enhancePending.current = false;
    enhanceStartedAt.current = null;
    enhanceStreamToken.current += 1;
    enhanceAbortController.current?.abort();
    enhanceAbortController.current = null;
    activeEnhanceRunIdRef.current = null;
    lastEnhanceInputSnapshotRef.current = null;
    activeEnhancementBuilderSignatureRef.current = null;
    setSessionDrawerOpen(false);
    setEnhanceSession(createCodexSession());
    setReasoningSummary("");
    clearEnhanceOverrides();
    setWebSearchSources([]);
    setWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY);
    setLastSuccessfulEnhancementBuilderSignature(null);
    setLastEnhancementArtifactBuilderSignature(null);
    setIsEnhancing(false);
    setEnhancePhase("idle");
  }, [clearEnhanceTimers, clearEnhanceOverrides, setIsEnhancing]);

  useEffect(() => {
    if (hasTrackedBuilderLoaded.current) return;
    hasTrackedBuilderLoaded.current = true;
    trackBuilderEvent("builder_loaded", {
      isMobile,
      isSignedIn,
      hasRemixParam: Boolean(remixId),
      hasPresetParam: Boolean(presetId),
      heroCopyExperimentEnabled: true,
      primaryCtaExperimentEnabled: false,
      heroCopyVariant,
    });
  }, [
    isMobile,
    isSignedIn,
    remixId,
    presetId,
    heroCopyVariant,
  ]);

  useEffect(() => {
    const restoredPrompt = consumeRestoredVersionPrompt();
    if (!restoredPrompt) return;
    resetEnhanceSessionState();
    setEnhancedPrompt(restoredPrompt);
    setLastSuccessfulEnhancementBuilderSignature(builderSignature);
    setReasoningSummary("");
    toast({ title: "Version restored", description: "Restored from History." });
    if (isMobile) {
      setDrawerOpen(true);
    }
  }, [
    builderSignature,
    isMobile,
    resetEnhanceSessionState,
    setEnhancedPrompt,
    toast,
  ]);

  useEffect(() => {
    if (!presetId) return;
    const preset = templates.find((t) => t.id === presetId);
    if (!preset) {
      trackBuilderEvent("preset_not_found", {
        presetId,
      });
      toast({
        title: "Preset not found",
        description: `No preset with id "${presetId}".`,
      });
      setSearchParams(
        (prev) => {
          prev.delete("preset");
          return prev;
        },
        { replace: true },
      );
      return;
    }
    resetEnhanceSessionState();
    loadTemplate(preset);
    const preferences = getUserPreferences();
    const nextRecentPresetIds = [
      preset.id,
      ...preferences.recentlyUsedPresetIds.filter((id) => id !== preset.id),
    ].slice(0, 8);
    setUserPreference("recentlyUsedPresetIds", nextRecentPresetIds);
    trackBuilderEvent("preset_applied", {
      presetId: preset.id,
      presetCategory: preset.category,
      hasStarterPrompt: Boolean(preset.starterPrompt.trim()),
    });
    toast({
      title: "Preset loaded",
      description: `"${preset.name}" applied to the builder.`,
    });
    setSearchParams(
      (prev) => {
        prev.delete("preset");
        return prev;
      },
      { replace: true },
    );
  }, [
    presetId,
    loadTemplate,
    resetEnhanceSessionState,
    toast,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!remixId) return;
    if (remixContext?.postId === remixId) return;
    const token = ++remixLoadToken.current;

    void (async () => {
      try {
        const post = await loadPost(remixId);
        if (token !== remixLoadToken.current) return;
        if (!post) {
          toast({
            title: "Remix unavailable",
            description: "That community prompt could not be loaded.",
          });
          return;
        }
        const [author] = await loadProfilesByIds([post.authorId]);
        if (token !== remixLoadToken.current) return;

        resetEnhanceSessionState();
        startRemix({
          postId: post.id,
          title: post.title,
          authorName: author?.displayName,
          publicConfig: post.publicConfig,
          parentTags: post.tags,
          parentCategory: post.category,
        });
        toast({
          title: "Remix ready",
          description: `Loaded “${post.title}” into Builder with context preserved.`,
        });
      } catch (error) {
        if (token !== remixLoadToken.current) return;
        toast({
          title: "Failed to load remix",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    })();
  }, [
    remixId,
    remixContext?.postId,
    resetEnhanceSessionState,
    startRemix,
    toast,
  ]);

  const handleClearRemix = useCallback(() => {
    resetEnhanceSessionState();
    clearRemix();
    if (!remixId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("remix");
    setSearchParams(next, { replace: true });
  }, [
    clearRemix,
    remixId,
    resetEnhanceSessionState,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    return () => clearEnhanceTimers();
  }, [clearEnhanceTimers]);

  const handleAdjustDetailsUpdate = useCallback(
    (updates: Partial<typeof config>) => {
      const fields = listInferenceFieldsFromUpdates(updates);
      if (fields.length > 0) {
        setFieldOwnership((previous) =>
          markOwnershipFields(previous, fields, "user"),
        );
        trackBuilderEvent("builder_field_manual_override", {
          fields: fields.join(","),
        });
      }

      updateConfig(updates);
    },
    [updateConfig],
  );

  const handleOpenSessionDrawer = useCallback(() => {
    if (!canManageCodexSession) {
      toast({
        title: "Sign in required",
        description: "Sign in to manage Codex session context.",
        variant: "destructive",
      });
      return;
    }
    setSessionDrawerOpen(true);
  }, [canManageCodexSession, toast]);

  const handleOpenSessionDrawerFromMobileSettings = useCallback(() => {
    setMobileEnhancementSettingsOpen(false);
    handleOpenSessionDrawer();
  }, [handleOpenSessionDrawer]);

  const handleUpdateEnhanceSession = useCallback(
    (
      updates: Partial<
        Pick<CodexSession, "contextSummary" | "latestEnhancedPrompt">
      >,
    ) => {
      setEnhanceSession((previous) =>
        createCodexSession({
          ...previous,
          ...updates,
          updatedAt: Date.now(),
        }),
      );
    },
    [],
  );

  const handleResetEnhanceSession = useCallback(() => {
    setEnhanceSession(createCodexSession());
  }, []);

  const selectedVariantPrompt = useMemo(() => {
    if (activeEnhancementVariant === "shorter") {
      return enhanceMetadata?.alternativeVersions?.shorter?.trim() ?? "";
    }
    if (activeEnhancementVariant === "more_detailed") {
      return enhanceMetadata?.alternativeVersions?.more_detailed?.trim() ?? "";
    }
    return "";
  }, [activeEnhancementVariant, enhanceMetadata]);

  const isEnhanceRunInFlight =
    isEnhancing ||
    enhancePhase === "starting" ||
    enhancePhase === "streaming" ||
    enhancePhase === "settling";
  const selectedEnhancedPrompt = selectedVariantPrompt || enhancedPrompt;
  const hasVisibleEnhancedOutput = selectedEnhancedPrompt.trim().length > 0;
  const latestEnhancementOutputBuilderSignature =
    activeEnhancementBuilderSignatureRef.current ??
    lastSuccessfulEnhancementBuilderSignature;
  const latestEnhancementArtifactBuilderSignatureValue =
    activeEnhancementBuilderSignatureRef.current ??
    lastSuccessfulEnhancementBuilderSignature ??
    lastEnhancementArtifactBuilderSignature;
  const hasEnhancedHistory = Boolean(
    lastSuccessfulEnhancementBuilderSignature ||
    hasVisibleEnhancedOutput ||
    enhanceMetadata ||
    enhanceWorkflow.length > 0 ||
    reasoningSummary.trim() ||
    webSearchSources.length > 0,
  );
  const hasCurrentEnhancedOutput = Boolean(
    !isEnhanceRunInFlight &&
    hasVisibleEnhancedOutput &&
    latestEnhancementOutputBuilderSignature &&
    latestEnhancementOutputBuilderSignature === builderSignature,
  );
  const hasCurrentEnhancementArtifacts = Boolean(
    latestEnhancementArtifactBuilderSignatureValue &&
    latestEnhancementArtifactBuilderSignatureValue === builderSignature &&
    (hasVisibleEnhancedOutput ||
      enhanceMetadata ||
      enhanceWorkflow.length > 0 ||
      reasoningSummary.trim() ||
      webSearchSources.length > 0),
  );
  const isEnhancementStale = Boolean(
    !isEnhanceRunInFlight &&
    hasEnhancedHistory &&
    hasVisibleEnhancedOutput &&
    !hasCurrentEnhancedOutput,
  );
  const currentEnhancedPrompt = hasCurrentEnhancedOutput
    ? selectedEnhancedPrompt
    : "";
  const currentPreviewPrompt = currentEnhancedPrompt || builtPrompt;
  const currentEnhanceMetadata = hasCurrentEnhancementArtifacts
    ? enhanceMetadata
    : null;
  const currentReasoningSummary = hasCurrentEnhancementArtifacts
    ? reasoningSummary
    : "";
  const currentEnhanceWorkflow = hasCurrentEnhancementArtifacts
    ? enhanceWorkflow
    : [];
  const currentWebSearchSources = hasCurrentEnhancementArtifacts
    ? webSearchSources
    : [];
  const effectiveActiveEnhancementVariant = hasCurrentEnhancedOutput
    ? activeEnhancementVariant
    : "original";
  const staleEnhancementNotice = isEnhancementStale
    ? "Builder changed since the last enhancement. Preview now shows the current draft prompt. Re-run Enhance prompt to refresh the AI result."
    : null;

  // Archived artifacts from the last settled enhancement, available for
  // secondary disclosures when the builder has diverged (stale state).
  const archivedEnhanceMetadata = isEnhancementStale ? enhanceMetadata : null;
  const archivedReasoningSummary = isEnhancementStale ? reasoningSummary : "";
  const archivedEnhanceWorkflow = isEnhancementStale ? enhanceWorkflow : [];
  const archivedWebSearchSources = isEnhancementStale ? webSearchSources : [];

  useEffect(() => {
    if (isEnhancing) return;
    if (!selectedEnhancedPrompt.trim()) return;
    if (
      activeEnhancementBuilderSignatureRef.current ||
      lastSuccessfulEnhancementBuilderSignature
    ) {
      return;
    }
    setLastSuccessfulEnhancementBuilderSignature(builderSignature);
  }, [
    builderSignature,
    isEnhancing,
    lastEnhancementArtifactBuilderSignature,
    lastSuccessfulEnhancementBuilderSignature,
    selectedEnhancedPrompt,
  ]);

  const updateActiveRunSnapshot = useCallback(
    (updates: Partial<Omit<EnhanceInputSnapshot, "runId">>) => {
      const runId = activeEnhanceRunIdRef.current;
      const current = lastEnhanceInputSnapshotRef.current;
      if (!runId || !current || current.runId !== runId) return;

      const next: EnhanceInputSnapshot = {
        ...current,
        ...updates,
      };
      next.isVaguePrompt = isVaguePrompt(
        next.inputWordCount,
        next.ambiguityLevel,
      );
      lastEnhanceInputSnapshotRef.current = next;
    },
    [],
  );

  const trackEnhanceAccepted = useCallback(
    (source: "copy" | "save" | "save_share") => {
      const runId = activeEnhanceRunIdRef.current;
      const snapshot = lastEnhanceInputSnapshotRef.current;
      const acceptedRunIds = acceptedRunIdsRef.current;
      const visiblePrompt = currentEnhancedPrompt.trim();

      if (
        !hasCurrentEnhancedOutput ||
        !runId ||
        !snapshot ||
        snapshot.runId !== runId ||
        !visiblePrompt
      ) {
        return;
      }
      if (acceptedRunIds.has(runId)) return;

      const nextSnapshot = {
        ...snapshot,
        selectedVariant: activeEnhancementVariant,
      };
      const measurementPayload = buildEnhanceMeasurementPayload(
        nextSnapshot,
        visiblePrompt,
      );

      lastEnhanceInputSnapshotRef.current = nextSnapshot;
      acceptedRunIds.add(runId);
      trackBuilderEvent("builder_enhance_accepted", {
        source,
        promptChars: visiblePrompt.length,
        variant: activeEnhancementVariant,
        ...measurementPayload,
      });

      syncEnhancementProfile({ type: "accepted" });
      const acceptedFormat =
        enhanceMetadata?.partsBreakdown?.output_format?.trim() ?? "";
      if (acceptedFormat) {
        syncEnhancementProfile({
          type: "format_accepted",
          format: acceptedFormat,
        });
      }
    },
    [
      activeEnhancementVariant,
      currentEnhancedPrompt,
      enhanceMetadata?.partsBreakdown?.output_format,
      hasCurrentEnhancedOutput,
      syncEnhancementProfile,
    ],
  );

  const handleAppendToSessionContext = useCallback(
    (content: string) => {
      if (!canManageCodexSession || !content.trim()) return;
      setEnhanceSession((previous) =>
        createCodexSession({
          ...previous,
          contextSummary: appendTextBlock(previous.contextSummary, content),
          updatedAt: Date.now(),
        }),
      );
      setSessionDrawerOpen(true);
    },
    [canManageCodexSession],
  );

  const handleUseCurrentPromptForSession = useCallback(() => {
    if (!canManageCodexSession) return;
    const promptSnapshot = currentPreviewPrompt.trim();
    if (!promptSnapshot) return;
    setEnhanceSession((previous) =>
      createCodexSession({
        ...previous,
        latestEnhancedPrompt: promptSnapshot,
        updatedAt: Date.now(),
      }),
    );
  }, [canManageCodexSession, currentPreviewPrompt]);

  const handleApplySuggestionChip = useCallback(
    (chip: BuilderSuggestionChip) => {
      if (chip.action.type === "append_prompt") {
        updateConfig({
          originalPrompt: `${config.originalPrompt}${chip.action.text}`,
        });
        return;
      }

      const fields =
        chip.action.fields.length > 0
          ? chip.action.fields
          : listInferenceFieldsFromUpdates(chip.action.updates);
      updateConfig(chip.action.updates);
      setFieldOwnership((previous) =>
        markOwnershipFields(previous, fields, "ai"),
      );
      setIsAdjustDetailsOpen(true);
      trackBuilderEvent("builder_inference_applied", {
        source: "chip",
        fields: fields.join(","),
      });
    },
    [config.originalPrompt, updateConfig],
  );

  const handleResetInferredDetails = useCallback(() => {
    const { updates, clearedFields, nextOwnership } =
      clearAiOwnedFields(fieldOwnership);
    if (clearedFields.length === 0) return;
    updateConfig(updates);
    setFieldOwnership(nextOwnership);
    setSuggestionChips([]);
    setHasInferenceError(false);
    trackBuilderEvent("builder_inference_applied", {
      source: "reset",
      clearedFields: clearedFields.join(","),
    });
  }, [fieldOwnership, updateConfig]);

  const handleEnhance = useCallback(() => {
    if (isEnhancing || enhancePending.current) return;
    enhancePending.current = true;

    void (async () => {
      const configForEnhance = config;
      const promptForEnhance = buildPrompt(configForEnhance);
      if (!promptForEnhance) {
        enhancePending.current = false;
        return;
      }

      enhanceStartedAt.current = Date.now();
      const previousSnapshot = lastEnhanceInputSnapshotRef.current;
      if (enhancedPrompt.trim()) {
        const selectedPromptText = selectedEnhancedPrompt.trim();
        const fallbackInputPrompt =
          previousSnapshot?.inputPromptText || promptForEnhance.trim();
        const fallbackInputWordCount = countPromptWords(fallbackInputPrompt);
        const fallbackAmbiguityLevel =
          previousSnapshot?.ambiguityLevel ??
          enhanceMetadata?.ambiguityLevel ??
          null;
        const rerunMeasurementInput: EnhanceMeasurementInput = {
          inputPromptText: fallbackInputPrompt,
          inputPromptChars:
            previousSnapshot?.inputPromptChars ?? fallbackInputPrompt.length,
          inputWordCount:
            previousSnapshot?.inputWordCount ?? fallbackInputWordCount,
          isVaguePrompt:
            previousSnapshot?.isVaguePrompt ??
            isVaguePrompt(fallbackInputWordCount, fallbackAmbiguityLevel),
          ambiguityLevel: fallbackAmbiguityLevel,
        };
        const rerunMeasurementPayload = buildEnhanceMeasurementPayload(
          rerunMeasurementInput,
          selectedPromptText,
        );

        trackBuilderEvent("builder_enhance_rerun", {
          previousPromptChars: selectedPromptText.length,
          variant:
            previousSnapshot?.selectedVariant ?? activeEnhancementVariant,
          ...rerunMeasurementPayload,
        });
        syncEnhancementProfile({ type: "rerun" });
      }
      const nextRunId = buildEnhanceRunId();
      const inputPromptText =
        configForEnhance.originalPrompt.trim() || promptForEnhance.trim();
      activeEnhanceRunIdRef.current = nextRunId;
      lastEnhanceInputSnapshotRef.current = createEnhanceInputSnapshot(
        nextRunId,
        inputPromptText,
        "original",
      );
      activeEnhancementBuilderSignatureRef.current = builderSignature;
      trackBuilderEvent("builder_enhance_clicked", {
        promptChars: promptForEnhance.length,
        hasExistingEnhancedPrompt: Boolean(enhancedPrompt.trim()),
      });
      clearEnhanceTimers();
      setEnhancePhase("starting");
      setIsEnhancing(true);
      enhancePending.current = false;
      setEnhancedPrompt("");
      setReasoningSummary("");
      setEnhanceMetadata(null);
      setEnhanceWorkflow([]);
      setWebSearchSources([]);
      setWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY);
      setLastEnhancementArtifactBuilderSignature(null);

      if (isMobile) {
        setMobileEnhancementSettingsOpen(false);
        setDrawerOpen(true);
      }

      enhanceStreamToken.current += 1;
      enhanceAbortController.current?.abort();
      const streamToken = enhanceStreamToken.current;
      const streamAbortController = new AbortController();
      enhanceAbortController.current = streamAbortController;

      let accumulated = "";
      let hasReceivedDelta = false;
      let hasReceivedStreamSignal = false;
      let hasStructuredOutput = false;
      const reasoningByItemId = new Map<string, string>();
      const reasoningItemOrder: string[] = [];
      const REASONING_FALLBACK_ITEM_ID = "__reasoning_summary__";
      let currentSearchActivity: WebSearchActivity = {
        ...IDLE_WEB_SEARCH_ACTIVITY,
      };
      const outputState = createEnhanceOutputStreamState();
      const debugEnhanceEvents = isEnhanceDebugEnabled();
      const debugEventStore =
        debugEnhanceEvents && typeof window !== "undefined"
          ? ((
            window as typeof window & {
              __promptforgeEnhanceEvents?: EnhanceDebugEventSnapshot[];
            }
          ).__promptforgeEnhanceEvents ??= [])
          : null;
      const outputFormats = [
        ...configForEnhance.format,
        configForEnhance.customFormat.trim(),
      ].filter((value) => value.length > 0);
      const outputFormatField = [
        outputFormats.join(", "),
        configForEnhance.lengthPreference
          ? `Length: ${configForEnhance.lengthPreference}`
          : "",
      ]
        .filter((value) => value.length > 0)
        .join(" | ");
      const guardrailItems = [
        ...configForEnhance.constraints,
        configForEnhance.customConstraint.trim(),
        configForEnhance.tone ? `Tone: ${configForEnhance.tone}` : "",
        configForEnhance.complexity
          ? `Complexity: ${configForEnhance.complexity}`
          : "",
      ].filter((value) => value.length > 0);
      const enhanceContextSources = buildEnhanceContextSources(
        configForEnhance.contextConfig.sources,
      );
      const markCurrentEnhancementArtifacts = () => {
        setLastEnhancementArtifactBuilderSignature(
          activeEnhancementBuilderSignatureRef.current ?? builderSignature,
        );
      };
      const updateLiveGeneratePromptWorkflow = (text: string) => {
        const detail = formatLiveGeneratePromptWorkflowDetail(text);
        if (!detail) return;

        markCurrentEnhancementArtifacts();
        setEnhanceWorkflow((previous) => {
          const existing = previous.find((step) => step.stepId === "generate_prompt");
          if (
            existing &&
            existing.status !== "pending" &&
            existing.status !== "running"
          ) {
            return previous;
          }

          return upsertEnhanceWorkflowStep(previous, {
            stepId: "generate_prompt",
            order: existing?.order ?? 40,
            label: existing?.label ?? "Generate enhanced prompt",
            status: "running",
            detail,
          });
        });
      };
      const settleGeneratePromptWorkflow = (
        status: "completed" | "failed",
        detail?: string,
      ) => {
        markCurrentEnhancementArtifacts();
        setEnhanceWorkflow((previous) => {
          const existing = previous.find((step) => step.stepId === "generate_prompt");
          if (
            existing &&
            existing.status !== "pending" &&
            existing.status !== "running"
          ) {
            return previous;
          }

          const normalizedDetail = detail?.trim() || existing?.detail;
          return upsertEnhanceWorkflowStep(previous, {
            stepId: "generate_prompt",
            order: existing?.order ?? 40,
            label: existing?.label ?? "Generate enhanced prompt",
            status,
            detail: normalizedDetail,
          });
        });
      };
      const applyEnhancedOutput = (
        nextOutput: string,
        clearSourcesWhenMissing = false,
      ) => {
        const { promptText, sources } =
          splitEnhancedPromptAndSources(nextOutput);
        if (sources.length > 0) {
          markCurrentEnhancementArtifacts();
          setEnhancedPrompt(promptText);
          setWebSearchSources(sources);
          return;
        }

        setEnhancedPrompt(promptText);
        if (clearSourcesWhenMissing) {
          setWebSearchSources([]);
        }
      };
      streamEnhance({
        prompt: promptForEnhance,
        session: enhanceSession,
        threadOptions: { ...ENHANCE_THREAD_OPTIONS_BASE, webSearchEnabled },
        builderMode: enhancementDepth,
        rewriteStrictness,
        intentOverride,
        ambiguityMode,
        builderFields: {
          role: (
            configForEnhance.customRole ||
            configForEnhance.role ||
            ""
          ).trim(),
          context: configForEnhance.context.trim(),
          task: (
            configForEnhance.originalPrompt ||
            configForEnhance.task ||
            ""
          ).trim(),
          outputFormat: outputFormatField,
          examples: configForEnhance.examples.trim(),
          guardrails: guardrailItems.join("; "),
        },
        contextSources: enhanceContextSources,
        signal: streamAbortController.signal,
        onDelta: (text) => {
          if (streamToken !== enhanceStreamToken.current) return;
          if (hasStructuredOutput) return;
          if (!hasReceivedStreamSignal) {
            hasReceivedStreamSignal = true;
            setEnhancePhase("streaming");
          }
          hasReceivedDelta = true;
          accumulated += text;
          applyEnhancedOutput(accumulated);
          updateLiveGeneratePromptWorkflow(accumulated);
        },
        onEvent: (event) => {
          if (streamToken !== enhanceStreamToken.current) return;
          if (debugEventStore) {
            debugEventStore.push(toEnhanceDebugEventSnapshot(event));
            if (debugEventStore.length > DEBUG_ENHANCE_EVENTS_MAX) {
              debugEventStore.splice(
                0,
                debugEventStore.length - DEBUG_ENHANCE_EVENTS_MAX,
              );
            }
          }

          const outputUpdate = applyEnhanceOutputEvent(
            outputState,
            {
              eventType: event.eventType,
              responseType: event.responseType,
              itemId: event.itemId,
              itemType: event.itemType,
            },
            event.payload,
          );
          if (outputUpdate.didHandle) {
            hasStructuredOutput = true;
            if (!hasReceivedStreamSignal) {
              hasReceivedStreamSignal = true;
              setEnhancePhase("streaming");
            }
            accumulated = outputUpdate.text;
            hasReceivedDelta = accumulated.length > 0;
            applyEnhancedOutput(accumulated);
            updateLiveGeneratePromptWorkflow(accumulated);
          }

          const workflowStep = parseEnhanceWorkflowStep(event.payload);
          if (workflowStep) {
            markCurrentEnhancementArtifacts();
            setEnhanceWorkflow((previous) =>
              upsertEnhanceWorkflowStep(previous, workflowStep),
            );
            return;
          }

          const metadataPrompt = extractEnhancedPromptFromMetadataEvent(
            event.payload,
          );
          if (metadataPrompt) {
            // Capture full metadata payload for the enhancement summary UI
            const innerPayload = (
              event.payload as { payload?: unknown }
            )?.payload;
            const parsed = parseEnhanceMetadata(innerPayload);
            if (parsed) {
              markCurrentEnhancementArtifacts();
              setEnhanceMetadata(parsed);
              updateActiveRunSnapshot({
                ambiguityLevel: parsed.ambiguityLevel ?? null,
              });
              trackBuilderEvent("builder_enhance_metadata_received", {
                hasAlternatives: Boolean(
                  parsed.alternativeVersions?.shorter ||
                  parsed.alternativeVersions?.more_detailed,
                ),
                enhancementCount: parsed.enhancementsMade?.length ?? 0,
                suggestionCount: parsed.suggestions?.length ?? 0,
                qualityOverall: parsed.qualityScore?.overall ?? null,
              });
            }

            const shouldApplyMetadata =
              !hasReceivedDelta ||
              shouldPreferMetadataPrompt(accumulated, metadataPrompt);
            if (shouldApplyMetadata) {
              accumulated = metadataPrompt;
              applyEnhancedOutput(metadataPrompt, true);
              hasReceivedDelta = true;
            } else {
              const { sources } = splitEnhancedPromptAndSources(metadataPrompt);
              if (sources.length > 0) {
                markCurrentEnhancementArtifacts();
                setWebSearchSources(sources);
              }
            }
            return;
          }

          const searchUpdate = extractWebSearchActivity(
            currentSearchActivity,
            event,
            event.payload,
          );
          if (searchUpdate) {
            currentSearchActivity = searchUpdate;
            setWebSearchActivity(searchUpdate);
            if (!hasReceivedStreamSignal) {
              hasReceivedStreamSignal = true;
              setEnhancePhase("streaming");
            }
            return;
          }

          const chunk = extractReasoningSummaryChunk(event, event.payload);
          if (!chunk?.text) return;
          if (!hasReceivedStreamSignal) {
            hasReceivedStreamSignal = true;
            setEnhancePhase("streaming");
          }

          const reasoningItemId = chunk.itemId || REASONING_FALLBACK_ITEM_ID;
          if (!reasoningByItemId.has(reasoningItemId)) {
            reasoningItemOrder.push(reasoningItemId);
          }

          const previous = reasoningByItemId.get(reasoningItemId) || "";
          const next = chunk.isDelta ? `${previous}${chunk.text}` : chunk.text;

          reasoningByItemId.set(reasoningItemId, next);
          const merged = reasoningItemOrder
            .map((itemId) => reasoningByItemId.get(itemId) || "")
            .filter((text) => text.length > 0)
            .join("\n\n")
            .trim();
          markCurrentEnhancementArtifacts();
          setReasoningSummary(merged);
        },
        onSession: (nextSession) => {
          if (streamToken !== enhanceStreamToken.current) return;
          setEnhanceSession(createCodexSession(nextSession));
        },
        onDone: () => {
          if (streamToken !== enhanceStreamToken.current) return;
          if (enhanceAbortController.current === streamAbortController) {
            enhanceAbortController.current = null;
          }
          const startedAt = enhanceStartedAt.current;
          const durationMs = startedAt
            ? Math.max(Date.now() - startedAt, 0)
            : -1;
          const finalPromptText = splitEnhancedPromptAndSources(accumulated)
            .promptText
            .trim();
          enhanceStartedAt.current = null;
          setWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY);
          if (!finalPromptText) {
            settleGeneratePromptWorkflow(
              "failed",
              "Enhancement completed without returning a prompt.",
            );
            activeEnhancementBuilderSignatureRef.current = null;
            trackBuilderEvent("builder_enhance_completed", {
              success: false,
              durationMs,
              error: "Enhancement completed without output.",
              errorCode: "bad_response",
            });
            clearEnhanceTimers();
            setIsEnhancing(false);
            setEnhancePhase("idle");
            toast({
              title: "Enhancement incomplete",
              description:
                "The enhancement finished without returning a prompt. Please try again.",
              variant: "destructive",
            });
            return;
          }
          setLastSuccessfulEnhancementBuilderSignature(
            activeEnhancementBuilderSignatureRef.current ?? builderSignature,
          );
          settleGeneratePromptWorkflow(
            "completed",
            formatLiveGeneratePromptWorkflowDetail(finalPromptText),
          );
          activeEnhancementBuilderSignatureRef.current = null;
          trackBuilderEvent("builder_enhance_completed", {
            success: true,
            durationMs,
            outputChars: accumulated.length,
            ...(lastEnhanceInputSnapshotRef.current
              ? buildEnhanceMeasurementPayload(
                lastEnhanceInputSnapshotRef.current,
                finalPromptText,
              )
              : {}),
          });
          syncEnhancementProfile({
            type: "enhancement_completed",
            depth: enhancementDepth,
            strictness: rewriteStrictness,
            ambiguityMode,
          });
          setIsEnhancing(false);
          setEnhancePhase("settling");
          const doneTimer = window.setTimeout(() => {
            setEnhancePhase("done");
          }, 260);
          const idleTimer = window.setTimeout(() => {
            setEnhancePhase("idle");
          }, 1800);
          enhancePhaseTimers.current.push(doneTimer, idleTimer);
          toast({
            title: "Quality pass complete",
            description:
              "Prompt updated with clearer structure, context, and constraints.",
          });
        },
        onError: (error: AIClientError) => {
          if (streamToken !== enhanceStreamToken.current) return;
          if (enhanceAbortController.current === streamAbortController) {
            enhanceAbortController.current = null;
          }
          if (error.code === "request_aborted") {
            activeEnhancementBuilderSignatureRef.current = null;
            return;
          }

          activeEnhancementBuilderSignatureRef.current = null;
          const errorMessage = error.message;
          settleGeneratePromptWorkflow("failed", errorMessage);
          const startedAt = enhanceStartedAt.current;
          const durationMs = startedAt
            ? Math.max(Date.now() - startedAt, 0)
            : -1;
          enhanceStartedAt.current = null;
          trackBuilderEvent("builder_enhance_completed", {
            success: false,
            durationMs,
            error: errorMessage,
            errorCode: error.code,
          });
          clearEnhanceTimers();
          setIsEnhancing(false);
          setEnhancePhase("idle");
          setWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY);
          toast({
            title: "Enhancement failed",
            description: errorMessage,
            variant: "destructive",
          });
        },
      });
    })();
  }, [
    activeEnhancementVariant,
    ambiguityMode,
    builderSignature,
    clearEnhanceTimers,
    config,
    enhanceMetadata?.ambiguityLevel,
    enhanceSession,
    enhancedPrompt,
    enhancementDepth,
    selectedEnhancedPrompt,
    intentOverride,
    isEnhancing,
    isMobile,
    rewriteStrictness,
    setEnhancedPrompt,
    setIsEnhancing,
    setReasoningSummary,
    syncEnhancementProfile,
    toast,
    updateActiveRunSnapshot,
    webSearchEnabled,
  ]);

  useEffect(() => {
    if (isEnhancing) return;
    clearEnhanceTimers();
    setEnhancePhase("idle");
  }, [builtPrompt, clearEnhanceTimers, isEnhancing]);

  useEffect(() => {
    if (isEnhancing) return;
    if (enhancedPrompt.trim()) return;
    setReasoningSummary((prev) => (prev ? "" : prev));
  }, [enhancedPrompt, isEnhancing]);

  const handleVariantChange = useCallback(
    (variant: EnhancementVariant) => {
      setActiveEnhancementVariant(variant);
      updateActiveRunSnapshot({ selectedVariant: variant });
      if (variant !== "original") {
        syncEnhancementProfile({ type: "variant_applied", variant });
      }
    },
    [syncEnhancementProfile, updateActiveRunSnapshot],
  );

  useEffect(() => {
    setActiveEnhancementVariant("original");
  }, [enhancedPrompt, enhanceMetadata?.enhancedPrompt]);

  // Personalization: apply preferred defaults from profile when user hasn't explicitly chosen
  useEffect(() => {
    if (enhancementProfileSnapshot.totalEnhancements < 3) return;

    const prefs = getUserPreferences();

    const preferredDepth = getMostUsedPreference(
      enhancementProfileSnapshot.depthCounts,
    );
    if (preferredDepth && prefs.enhancementDepth === "guided") {
      setEnhancementDepth(preferredDepth as EnhancementDepth);
    }

    const preferredStrictness = getMostUsedPreference(
      enhancementProfileSnapshot.strictnessCounts,
    );
    if (preferredStrictness && prefs.rewriteStrictness === "balanced") {
      setRewriteStrictness(preferredStrictness as RewriteStrictness);
    }

    const preferredAmbiguity = getMostUsedPreference(
      enhancementProfileSnapshot.ambiguityModeCounts,
    );
    if (preferredAmbiguity && prefs.ambiguityMode === "infer_conservatively") {
      setAmbiguityMode(preferredAmbiguity as AmbiguityMode);
    }
  }, [enhancementProfileSnapshot]);

  useEffect(() => {
    return () => {
      clearEnhanceTimers();
      enhanceStreamToken.current += 1;
      enhanceAbortController.current?.abort();
      enhanceAbortController.current = null;
    };
  }, [clearEnhanceTimers]);

  const handleSavePrompt = useCallback(
    async (input: {
      name: string;
      description?: string;
      tags?: string[];
      category?: string;
      remixNote?: string;
    }): Promise<boolean> => {
      try {
        const result = await savePrompt({
          title: input.name,
          description: input.description,
          tags: input.tags,
          category: input.category,
          remixNote: input.remixNote,
        }, {
          enhancedPromptOverride: hasCurrentEnhancedOutput
            ? currentEnhancedPrompt
            : "",
        });
        const warningText =
          result.warnings.length > 0
            ? ` ${result.warnings.length} validation warning(s) were recorded.`
            : "";
        const verb =
          result.outcome === "created"
            ? "saved"
            : result.outcome === "updated"
              ? "updated"
              : "unchanged";
        toast({
          title: `Prompt ${verb}: ${result.record.metadata.name}`,
          description: `Revision r${result.record.metadata.revision}.${warningText}`,
        });
        if (hasCurrentEnhancedOutput) {
          trackEnhanceAccepted("save");
        }
        if (remixContext) {
          handleClearRemix();
        }
        return true;
      } catch (error) {
        toast({
          title: "Failed to save prompt",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
        return false;
      }
    },
    [
      savePrompt,
      toast,
      remixContext,
      handleClearRemix,
      currentEnhancedPrompt,
      hasCurrentEnhancedOutput,
      trackEnhanceAccepted,
    ],
  );

  const handleSaveAndSharePrompt = useCallback(
    async (input: {
      name: string;
      description?: string;
      tags?: string[];
      category?: string;
      useCase: string;
      targetModel?: string;
      remixNote?: string;
    }): Promise<boolean> => {
      if (!isSignedIn) {
        toast({
          title: "Sign in required",
          description: "Sign in to share prompts.",
          variant: "destructive",
        });
        return false;
      }

      try {
        const result = await saveAndSharePrompt({
          title: input.name,
          description: input.description,
          tags: input.tags,
          category: input.category,
          useCase: input.useCase,
          targetModel: input.targetModel,
          remixNote: input.remixNote,
        }, {
          enhancedPromptOverride: hasCurrentEnhancedOutput
            ? currentEnhancedPrompt
            : "",
        });
        toast({
          title: `Prompt shared: ${result.record.metadata.name}`,
          description: `Revision r${result.record.metadata.revision}.`,
          action: result.postId ? (
            <ToastAction altText="View post" asChild>
              <Link to={`/community/${result.postId}`}>View</Link>
            </ToastAction>
          ) : undefined,
        });
        if (hasCurrentEnhancedOutput) {
          trackEnhanceAccepted("save_share");
        }
        if (remixContext) {
          handleClearRemix();
        }
        return true;
      } catch (error) {
        toast({
          title: "Failed to save & share prompt",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
        return false;
      }
    },
    [
      isSignedIn,
      saveAndSharePrompt,
      toast,
      remixContext,
      handleClearRemix,
      currentEnhancedPrompt,
      hasCurrentEnhancedOutput,
      trackEnhanceAccepted,
    ],
  );

  const detectedIntent: IntentRoute | null = useMemo(() => {
    const draftDetection = detectDraftIntent(config.originalPrompt, {
      role: config.customRole || config.role,
      context: config.context,
      outputFormats: extractSelectedOutputFormats(config),
      hasAttachedSources: config.contextConfig.sources.length > 0,
      hasSessionContext: Boolean(
        enhanceSession.contextSummary.trim() ||
        enhanceSession.latestEnhancedPrompt.trim(),
      ),
      hasPastedSourceMaterial:
        looksLikePastedSourceMaterial(config.originalPrompt) ||
        looksLikePastedSourceMaterial(config.contextConfig.projectNotes),
    });

    if (draftDetection.intent && isIntentRoute(draftDetection.intent)) {
      return draftDetection.intent;
    }

    return null;
  }, [config, enhanceSession.contextSummary, enhanceSession.latestEnhancedPrompt]);

  const handleIntentOverrideChange = useCallback((intent: IntentRoute | null) => {
    const previousEffectiveIntent = intentOverride ?? detectedIntent ?? "auto";
    const nextEffectiveIntent = intent ?? "auto";

    setIntentOverride(intent);

    if (previousEffectiveIntent !== nextEffectiveIntent) {
      trackBuilderEvent("builder_enhance_intent_overridden", {
        fromIntent: previousEffectiveIntent,
        toIntent: nextEffectiveIntent,
      });
    }

    if (intent && previousEffectiveIntent !== nextEffectiveIntent) {
      syncEnhancementProfile({ type: "intent_overridden", intent });
    }
  }, [intentOverride, detectedIntent, syncEnhancementProfile]);

  const handleEnhancementDepthChange = useCallback((depth: EnhancementDepth) => {
    setEnhancementDepth(depth);
    setUserPreference("enhancementDepth", depth);
  }, []);

  const handleRewriteStrictnessChange = useCallback((strictness: RewriteStrictness) => {
    setRewriteStrictness(strictness);
    setUserPreference("rewriteStrictness", strictness);
  }, []);

  const handleAmbiguityModeChange = useCallback((mode: AmbiguityMode) => {
    setAmbiguityMode(mode);
    setUserPreference("ambiguityMode", mode);
  }, []);

  // Keyboard shortcut: Ctrl+Enter to enhance prompt
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleEnhance();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleEnhance]);

  const sourceCount = config.contextConfig.sources.length;
  const sectionHealth = getSectionHealth(config, score.total);
  const hasEnhancementQualityScore = Boolean(
    currentEnhanceMetadata?.qualityScore,
  );
  const builderQualityLabel = `Builder readiness score ${score.total} out of 100`;
  const selectedRole = config.customRole || config.role;
  const handleSaveVersion = useCallback(() => {
    saveVersion(undefined, currentPreviewPrompt);
  }, [currentPreviewPrompt, saveVersion]);
  const sessionDrawerSummary = useMemo(() => {
    if (!canManageCodexSession) {
      return "Sign in to manage the Codex session and carry supplemental context across turns.";
    }
    if (enhanceSession.contextSummary.trim()) {
      return "Outside context is ready to carry into the next Codex turn.";
    }
    if (enhanceSession.threadId) {
      return "This builder is already attached to a Codex thread.";
    }
    return "Open the drawer to add supplemental context before the next enhancement pass.";
  }, [
    canManageCodexSession,
    enhanceSession.contextSummary,
    enhanceSession.threadId,
  ]);
  const hasBuiltPrompt = builtPrompt.trim().length > 0;
  const hasOriginalPromptInput = config.originalPrompt.trim().length > 0;
  const hasBuilderDrivenInput = hasBuilderFieldInput(config);
  const builderQualityHint = hasEnhancementQualityScore
    ? "Readiness signal for the current draft. The enhancer self-check now lives inside Enhancement details."
    : isEnhancementStale
      ? "Readiness signal for the current draft. Builder changes made the last enhancement stale."
      : hasCurrentEnhancedOutput
        ? "Readiness signal for the current draft while you review the enhanced result."
        : "Readiness signal for the current draft before enhancement.";
  const hasDetailSelections = Boolean(
    selectedRole ||
    config.format.length ||
    config.customFormat.trim() ||
    config.constraints.length ||
    config.customConstraint.trim() ||
    config.examples.trim(),
  );
  const hasSourceOrAdvancedSelections = Boolean(
    config.contextConfig.sources.length ||
    config.contextConfig.projectNotes.trim() ||
    config.contextConfig.databaseConnections.length ||
    config.contextConfig.rag.enabled,
  );
  const hasStartedBuilderFlow =
    hasOriginalPromptInput ||
    hasEnhancedHistory ||
    hasDetailSelections ||
    hasSourceOrAdvancedSelections ||
    showAdvancedControls ||
    isAdjustDetailsOpen ||
    isSourcesAdvancedOpen;
  const showEnhanceFirstCard = !hasStartedBuilderFlow;
  const shouldShowAdvancedControls =
    showAdvancedControls ||
    hasEnhancedHistory ||
    hasDetailSelections ||
    hasSourceOrAdvancedSelections;
  const previewSource: OutputPreviewSource = hasCurrentEnhancedOutput
    ? "enhanced"
    : hasBuiltPrompt
      ? hasBuilderDrivenInput
        ? "builder_fields"
        : hasOriginalPromptInput
          ? "prompt_text"
          : "builder_fields"
      : "empty";
  const hasUnenhancedPreview =
    !hasCurrentEnhancedOutput && builtPrompt.trim().length > 0;
  const canSavePrompt = hasPromptInput(config);
  const canSharePrompt = canSavePrompt && isSignedIn;
  const mobileEnhanceLabel = isEnhancing
    ? enhancePhase === "starting"
      ? "Starting…"
      : enhancePhase === "settling"
        ? "Finalizing…"
        : "Enhancing…"
    : enhancePhase === "done"
      ? "Enhanced"
      : primaryCtaLabel;
  const mobileReviewState = getOutputPanelReviewState({
    enhancePhase,
    isEnhancing,
    previewSource,
    hasPreviewContent: currentPreviewPrompt.trim().length > 0,
    staleEnhancementNotice,
  });
  const enhanceLiveMessage =
    mobileReviewState.stateKey === "empty"
      ? ""
      : mobileReviewState.assistiveStatus;
  const mobilePreviewText = useMemo(() => {
    const trimmed = currentPreviewPrompt.trim();
    if (!trimmed) {
      return "Start writing to generate a draft prompt.";
    }
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 1)
      .join(" ");
  }, [currentPreviewPrompt]);
  const mobilePreviewLabel = hasCurrentEnhancedOutput
    ? "Enhanced prompt"
    : currentPreviewPrompt.trim()
      ? "Draft prompt"
      : "No preview yet";
  const mobilePreviewActionLabel = hasCurrentEnhancedOutput
    ? "Enhanced"
    : currentPreviewPrompt.trim()
      ? "Draft"
      : "Preview";
  const mobilePreviewTitle = `${mobilePreviewLabel}. ${mobilePreviewText}`;
  const mobileEnhancementSummary = useMemo(
    () =>
      getEnhancementSettingsSummary({
        enhancementDepth,
        rewriteStrictness,
        ambiguityMode,
      }),
    [ambiguityMode, enhancementDepth, rewriteStrictness],
  );
  const handleEditMobileEnhancementSettings = useCallback(() => {
    setDrawerOpen(false);
    setMobileEnhancementSettingsOpen(true);
  }, []);
  const desktopEnhanceControlsMode = hasCurrentEnhancedOutput
    ? "full"
    : "compact";
  const showCompactDesktopReadiness = !hasCurrentEnhancedOutput;
  const builderScoreAxes = useMemo(
    () =>
      ([
        {
          label: "Clarity",
          value: score.clarity,
          tip: "How specific and detailed your task description is",
        },
        {
          label: "Context",
          value: score.context,
          tip: "Background info, role, sources, and structured data",
        },
        {
          label: "Specificity",
          value: score.specificity,
          tip: "Output format, length, examples, and constraints",
        },
        {
          label: "Structure",
          value: score.structure,
          tip: "Role, tone, complexity, and formatting choices",
        },
      ] as const),
    [score.clarity, score.context, score.specificity, score.structure],
  );
  const refineSuggestions = useMemo(() => {
    const suggestions: Array<{
      id: BuilderSection;
      title: string;
      description: string;
    }> = [];
    if (sectionHealth.builder !== "complete") {
      suggestions.push({
        id: "builder",
        title: selectedRole ? "Add task details" : "Add a role",
        description:
          "Clarify who the model should be and what outcome you need.",
      });
    }
    if (sectionHealth.context !== "complete") {
      suggestions.push({
        id: "context",
        title: "Add context",
        description:
          "Include sources, notes, or constraints from your environment.",
      });
    }
    if (sectionHealth.tone !== "complete") {
      suggestions.push({
        id: "tone",
        title: "Tune tone",
        description:
          "Set style and complexity to better match the target audience.",
      });
    }
    return suggestions.slice(0, 3);
  }, [
    sectionHealth.builder,
    sectionHealth.context,
    sectionHealth.tone,
    selectedRole,
  ]);
  const showRefineSuggestions =
    Boolean(enhancedPrompt.trim()) && refineSuggestions.length > 0;
  const hasAiOwnedFields = hasFieldOwnershipValue(fieldOwnership, "ai");
  const canResetAllBuilder =
    builderSignature !== DEFAULT_BUILDER_SIGNATURE || intentOverride !== null;
  const hasLearnedEnhancementProfile = hasEnhancementProfileData(
    enhancementProfileSnapshot,
  );
  const canResetEnhancementPreferences =
    enhancementDepth !== DEFAULT_ENHANCEMENT_DEPTH ||
    rewriteStrictness !== DEFAULT_REWRITE_STRICTNESS ||
    ambiguityMode !== DEFAULT_AMBIGUITY_MODE ||
    hasLearnedEnhancementProfile;

  useEffect(() => {
    if (hasTrackedFirstInput.current) return;
    const trimmedPrompt = config.originalPrompt.trim();
    if (!trimmedPrompt) return;

    hasTrackedFirstInput.current = true;
    trackBuilderEvent("builder_first_input", {
      promptChars: trimmedPrompt.length,
    });
  }, [config.originalPrompt]);

  const handleClearPrompt = useCallback(() => {
    if (hasUnenhancedPreview) {
      trackBuilderEvent("builder_clear_prompt_with_preview", {
        previewSource,
      });
    }
    resetEnhanceSessionState();
    clearOriginalPrompt();
  }, [
    clearOriginalPrompt,
    hasUnenhancedPreview,
    previewSource,
    resetEnhanceSessionState,
  ]);

  const handleResetAll = useCallback(() => {
    resetEnhanceSessionState();
    resetConfig();
  }, [resetConfig, resetEnhanceSessionState]);

  useEffect(() => {
    setFieldOwnership((previous) => {
      const baseline = createFieldOwnershipFromConfig(config);
      let changed = false;
      const next: BuilderFieldOwnershipMap = { ...previous };
      (Object.keys(next) as Array<keyof BuilderFieldOwnershipMap>).forEach(
        (field) => {
          if (baseline[field] === "user" && previous[field] === "empty") {
            next[field] = "user";
            changed = true;
          }
          if (baseline[field] === "empty" && previous[field] === "user") {
            next[field] = "empty";
            changed = true;
          }
        },
      );
      return changed ? next : previous;
    });
  }, [config]);

  useEffect(() => {
    if (
      hasEnhancedHistory ||
      hasDetailSelections ||
      hasSourceOrAdvancedSelections
    ) {
      persistedSetShowAdvancedControls(true);
    }
    if (hasDetailSelections || hasEnhancedHistory) {
      setIsAdjustDetailsOpen(true);
    }
    if (hasSourceOrAdvancedSelections || hasEnhancedHistory) {
      setIsSourcesAdvancedOpen(true);
    }
  }, [
    hasEnhancedHistory,
    hasDetailSelections,
    hasSourceOrAdvancedSelections,
    persistedSetShowAdvancedControls,
  ]);

  useEffect(() => {
    if (isSignedIn || !sessionDrawerOpen) return;
    setSessionDrawerOpen(false);
  }, [isSignedIn, sessionDrawerOpen]);

  useEffect(() => {
    if (!isAdjustDetailsOpen || hasTrackedZone2Opened.current) return;

    hasTrackedZone2Opened.current = true;
    trackBuilderEvent("builder_zone2_opened", {
      selectedRole: Boolean(selectedRole),
      formatCount: config.format.length,
      constraintCount: config.constraints.length,
      hasExamples: Boolean(config.examples.trim()),
    });
  }, [
    isAdjustDetailsOpen,
    selectedRole,
    config.format.length,
    config.constraints.length,
    config.examples,
  ]);

  useEffect(() => {
    if (!isSourcesAdvancedOpen || hasTrackedZone3Opened.current) return;

    hasTrackedZone3Opened.current = true;
    trackBuilderEvent("builder_zone3_opened", {
      sourceCount: config.contextConfig.sources.length,
      hasProjectNotes: Boolean(config.contextConfig.projectNotes.trim()),
      databaseCount: config.contextConfig.databaseConnections.length,
      ragEnabled: config.contextConfig.rag.enabled,
    });
  }, [
    isSourcesAdvancedOpen,
    config.contextConfig.sources.length,
    config.contextConfig.projectNotes,
    config.contextConfig.databaseConnections.length,
    config.contextConfig.rag.enabled,
  ]);

  useEffect(() => {
    const prompt = config.originalPrompt.trim();
    if (prompt.length < 24) {
      suggestionLoadToken.current += 1;
      resetBuilderInferenceRetry();
      setSuggestionChips([]);
      setHasInferenceError(false);
      setInferenceStatusMessage(null);
      setIsInferringSuggestions(false);
      return;
    }

    const requestContext = buildInferenceRequestContext({
      config,
      enhanceSession,
      hasPresetOrRemix: Boolean(remixContext || presetId),
    });
    const localFallback = inferBuilderFieldsLocally(prompt, config, requestContext);
    const hasLocalFallbackSuggestions = localFallback.suggestionChips.length > 0;
    const retryAt = builderInferenceRetryAt.current;
    if (typeof retryAt === "number" && retryAt > Date.now()) {
      setSuggestionChips(localFallback.suggestionChips);
      setHasInferenceError(true);
      setInferenceStatusMessage(
        getBuilderInferenceFallbackMessage(hasLocalFallbackSuggestions),
      );
      setIsInferringSuggestions(false);
      return;
    }

    const token = ++suggestionLoadToken.current;
    const abortController = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setIsInferringSuggestions(true);
        const timeout = window.setTimeout(() => abortController.abort(), 12_000);
        try {
          const remote = await inferBuilderFields({
            prompt,
            currentFields: buildInferenceCurrentFields(config),
            lockMetadata: fieldOwnership,
            requestContext,
            signal: abortController.signal,
          });

          if (token !== suggestionLoadToken.current) return;

          const normalized = normalizeRemoteInferenceResult(remote);
          if (normalized.inferredFields.length > 0) {
            const { updates, appliedFields } = applyInferenceUpdates(
              config,
              fieldOwnership,
              normalized,
            );
            if (appliedFields.length > 0) {
              updateConfig(updates);
              setFieldOwnership((previous) =>
                markOwnershipFields(previous, appliedFields, "ai"),
              );
              trackBuilderEvent("builder_inference_applied", {
                source: "suggestion_remote",
                fields: appliedFields.join(","),
              });
            }
          }
          if (normalized.suggestionChips.length > 0) {
            setSuggestionChips(normalized.suggestionChips);
          } else {
            setSuggestionChips(localFallback.suggestionChips);
          }
          resetBuilderInferenceRetry();
          setHasInferenceError(false);
          setInferenceStatusMessage(null);
        } catch (error) {
          if (token !== suggestionLoadToken.current) return;
          setSuggestionChips(localFallback.suggestionChips);
          setHasInferenceError(true);
          setInferenceStatusMessage(
            getBuilderInferenceFallbackMessage(hasLocalFallbackSuggestions),
          );
          scheduleBuilderInferenceRetry(error);
        } finally {
          window.clearTimeout(timeout);
          if (token === suggestionLoadToken.current) {
            setIsInferringSuggestions(false);
          }
        }
      })();
    }, 450);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
      suggestionLoadToken.current += 1;
    };
  }, [
    config,
    builderInferenceRetryNonce,
    enhanceSession,
    fieldOwnership,
    presetId,
    resetBuilderInferenceRetry,
    remixContext,
    scheduleBuilderInferenceRetry,
    updateConfig,
  ]);

  const openAndFocusSection = useCallback(
    (section: BuilderSection) => {
      const targetId =
        section === "context" ? "builder-zone-3" : "builder-zone-2";
      persistedSetShowAdvancedControls(true);
      if (section === "context") {
        setIsSourcesAdvancedOpen(true);
      } else {
        setIsAdjustDetailsOpen(true);
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          document.getElementById(targetId)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        });
      });
    },
    [persistedSetShowAdvancedControls],
  );

  const handleApplyToBuilder = useCallback(
    (updates: ApplyToBuilderUpdate) => {
      const configUpdates: Partial<typeof config> = {};

      if (updates.role) {
        configUpdates.customRole = updates.role;
        configUpdates.role = "";
      }
      if (updates.context) {
        configUpdates.context = updates.context;
      }
      if (updates.task) {
        configUpdates.originalPrompt = appendTextBlock(
          config.originalPrompt || config.task,
          updates.task,
        );
        configUpdates.task = "";
      }
      if (updates.format) {
        const { customFormat, lengthPreference } = reconcileFormatLength(
          updates.format,
        );
        configUpdates.customFormat = customFormat;
        configUpdates.format = [];
        if (lengthPreference) {
          configUpdates.lengthPreference = lengthPreference;
        }
      }
      if (updates.examples) {
        configUpdates.examples = updates.examples;
      }
      if (updates.constraints) {
        const normalizedConstraintUpdates = partitionConstraintText(
          updates.constraints,
        );
        configUpdates.customConstraint =
          normalizedConstraintUpdates.customConstraint;
        configUpdates.constraints = normalizedConstraintUpdates.constraints;
      }

      updateConfig(configUpdates);
      const fields = listInferenceFieldsFromUpdates(configUpdates);
      if (fields.length > 0) {
        setFieldOwnership((previous) =>
          markOwnershipFields(previous, fields, "user"),
        );
      }

      if (updates.action === "apply_all") {
        syncEnhancementProfile({
          type: "structured_apply_all",
          key: updates.sourceField ?? "all",
        });
      }

      const sections = updates.openSections ?? ["builder"];
      const primarySection = sections[0];
      if (primarySection) {
        openAndFocusSection(primarySection);
      }
      if (sections.includes("context") && primarySection !== "context") {
        window.requestAnimationFrame(() => {
          openAndFocusSection("context");
        });
      }
    },
    [
      config.originalPrompt,
      config.task,
      openAndFocusSection,
      syncEnhancementProfile,
      updateConfig,
    ],
  );

  const handleAppendClarificationBlockToPrompt = useCallback(
    (block: string) => {
      if (!block.trim()) return;
      updateConfig({
        originalPrompt: appendTextBlock(config.originalPrompt, block),
      });
      openAndFocusSection("builder");
    },
    [config.originalPrompt, openAndFocusSection, updateConfig],
  );

  const handleEditableListSaved = useCallback(
    (edit: EditableEnhancementListEdit) => {
      const before = edit.before.trim();
      const after = edit.after.trim();
      if (!after || before === after) return;

      trackBuilderEvent("builder_enhance_assumption_edited", {
        field: edit.field,
        index: edit.index,
        beforeChars: before.length,
        afterChars: after.length,
        source: edit.source,
      });
      syncEnhancementProfile({
        type: "assumption_edited",
        key: edit.field,
      });
    },
    [syncEnhancementProfile],
  );

  const handleApplyEditableListToPrompt = useCallback(
    (field: EditableEnhancementListField, items: string[]) => {
      const block =
        field === "open_questions" || field === "plan_open_questions"
          ? buildClarificationBlock(items)
          : buildAssumptionsCorrectionBlock(items);

      if (!block.trim()) return;

      updateConfig({
        originalPrompt: appendTextBlock(config.originalPrompt, block),
      });
      openAndFocusSection("builder");
    },
    [config.originalPrompt, openAndFocusSection, updateConfig],
  );

  const handleResetEnhancementPreferences = useCallback(() => {
    resetEnhancementProfile();
    setEnhancementProfileSnapshot(loadEnhancementProfile());
    setEnhancementDepth(DEFAULT_ENHANCEMENT_DEPTH);
    setRewriteStrictness(DEFAULT_REWRITE_STRICTNESS);
    setAmbiguityMode(DEFAULT_AMBIGUITY_MODE);
    setUserPreference("enhancementDepth", DEFAULT_ENHANCEMENT_DEPTH);
    setUserPreference("rewriteStrictness", DEFAULT_REWRITE_STRICTNESS);
    setUserPreference("ambiguityMode", DEFAULT_AMBIGUITY_MODE);
    toast({
      title: "Enhancement preferences reset",
      description:
        "Learned enhancement behavior and enhancement-specific defaults were restored to baseline.",
    });
  }, [toast]);

  const preferredAcceptedFormat = getMostUsedPreference(
    enhancementProfileSnapshot.formatCounts,
  );

  return (
    <PageShell mainClassName="py-3 sm:py-6">
      {isMobile && (
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {enhanceLiveMessage}
        </p>
      )}
      {/* Hero — collapsible for returning users */}
      {heroCollapsed ? (
        <button
          type="button"
          onClick={() => {
            setHeroCollapsed(false);
            try { localStorage.removeItem("pf-hero-dismissed"); } catch { /* noop */ }
          }}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-card/80 sm:mb-8"
          data-testid="builder-hero-collapsed"
        >
          <Sparkles className="h-3 w-3" />
          PromptForge — Turn rough ideas into quality prompts
        </button>
      ) : (
        <div
          className="pf-gilded-frame pf-hero-surface relative mb-4 px-4 py-4 text-center sm:mb-8 sm:px-6 sm:py-6"
          data-testid="builder-hero"
        >
          <button
            type="button"
            onClick={() => {
              setHeroCollapsed(true);
              try { localStorage.setItem("pf-hero-dismissed", "1"); } catch { /* noop */ }
            }}
            className="absolute right-3 top-3 rounded-md p-1 text-pf-parchment/60 hover:text-pf-parchment/90 transition-colors"
            aria-label="Collapse hero"
          >
            <X className="h-4 w-4" />
          </button>
          <h1 className="pf-text-display mb-1 text-3xl font-bold tracking-tight text-pf-parchment/95 sm:mb-2 md:text-4xl">
            {heroCopy.headline}
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-pf-parchment/90 sm:text-base">
            {heroCopy.subhead}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {brandCopy.pillars.map((pillar) => (
              <Badge
                key={pillar.title}
                variant="modern"
                className="border border-pf-gold/35 bg-pf-coal/35 text-xs text-pf-parchment/90"
              >
                {pillar.title}
              </Badge>
            ))}
          </div>
          <div className="mx-auto mt-3 w-44 pf-divider" />
        </div>
      )}

      {remixContext && (
        <Card className="mb-4 border-primary/30 bg-primary/5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="type-label-caps text-xs text-primary">Remix mode</p>
              <p className="text-sm font-medium text-foreground">
                Remixing {remixContext.parentAuthor}’s “
                {remixContext.parentTitle}”
              </p>
              <p className="text-xs text-muted-foreground">
                Your changes will be attributed when you save or share.
              </p>
            </div>
            <Button
              variant="tertiary"
              size="sm"
              onClick={handleClearRemix}
              className="utility-action-button gap-1.5 text-sm sm:text-sm"
            >
              <X className="h-3 w-3" />
              Clear remix
            </Button>
          </div>
        </Card>
      )}

      {/* Split layout */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        {/* Left: Input & Builder */}
        <div className="min-w-0 space-y-3 sm:space-y-4">
          <BuilderHeroInput
            value={config.originalPrompt}
            onChange={(value) => updateConfig({ originalPrompt: value })}
            onClear={handleClearPrompt}
            onResetAll={canResetAllBuilder ? handleResetAll : undefined}
            phase3Enabled
            suggestionChips={suggestionChips}
            isInferringSuggestions={isInferringSuggestions}
            hasInferenceError={hasInferenceError}
            inferenceStatusMessage={inferenceStatusMessage}
            onApplySuggestion={handleApplySuggestionChip}
            onResetInferred={handleResetInferredDetails}
            canResetInferred={hasAiOwnedFields}
            detectedIntent={detectedIntent}
            intentOverride={intentOverride}
            onIntentOverrideChange={handleIntentOverrideChange}
          />

          {showEnhanceFirstCard && (
            <Card className="border-border/70 bg-card/80 p-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Start in 3 steps
                </p>
                <ol className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-3">
                  <li>1. Add your rough prompt</li>
                  <li>
                    2. {isMobile ? "Tap" : "Click"} {primaryCtaLabel}
                  </li>
                  <li>3. Refine details</li>
                </ol>
                <p className="text-sm text-muted-foreground">
                  Keep the first pass simple, then strengthen quality,
                  context, and remix readiness.
                </p>
              </div>
            </Card>
          )}

          {showRefineSuggestions && (
            <Card className="border-primary/25 bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary">
                Improve this result
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {refineSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion.id}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-11 text-sm sm:h-9 sm:text-sm"
                    onClick={() => openAndFocusSection(suggestion.id)}
                  >
                    {suggestion.title}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {refineSuggestions[0]?.description}
              </p>
            </Card>
          )}

          {!shouldShowAdvancedControls && (
            <Card className="border-border/70 bg-card/80 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Need more control?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reveal prompt details and context controls when you are ready to refine the draft.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-11 text-sm sm:h-10 sm:text-sm"
                  onClick={() => persistedSetShowAdvancedControls(true)}
                >
                  Show advanced controls
                </Button>
              </div>
            </Card>
          )}

          {shouldShowAdvancedControls && (
            <>
              <BuilderAdjustDetails
                config={config}
                isOpen={isAdjustDetailsOpen}
                onOpenChange={setIsAdjustDetailsOpen}
                onUpdate={handleAdjustDetailsUpdate}
                fieldOwnership={fieldOwnership}
              />

              <BuilderSourcesAdvanced
                contextConfig={config.contextConfig}
                isOpen={isSourcesAdvancedOpen}
                onOpenChange={setIsSourcesAdvancedOpen}
                onUpdateSources={updateContextSources}
                onUpdateDatabaseConnections={updateDatabaseConnections}
                onUpdateRag={updateRagParameters}
                onUpdateProjectNotes={updateProjectNotes}
                onToggleDelimiters={toggleDelimiters}
              />
            </>
          )}

        </div>

        {/* Right: Output — inline on desktop, drawer on mobile */}
        {!isMobile && (
          <div className="min-w-0 space-y-3 lg:sticky lg:top-20 lg:self-start">
            <Card
              className="pf-panel mb-3 border-border/70 bg-card/80 p-3"
              data-testid="builder-readiness-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Builder readiness
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {builderQualityHint}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tipsWithOwnership?.[0] ||
                      "Add context and constraints to improve quality."}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="type-label-caps text-xs font-medium text-muted-foreground">
                    Builder
                  </span>
                  <Badge
                    variant="pill"
                    tone={score.total >= 75 ? "brand" : "default"}
                    className="text-xs"
                    aria-label={builderQualityLabel}
                    title={builderQualityLabel}
                  >
                    <span className="sr-only">{builderQualityLabel}</span>
                    <span aria-hidden="true">{score.total}/100</span>
                  </Badge>
                </div>
              </div>
              {showCompactDesktopReadiness ? (
                <>
                  <div
                    className="mt-3 grid grid-cols-2 gap-2"
                    data-testid="builder-readiness-summary-grid"
                  >
                    {builderScoreAxes.map((axis) => (
                      <div
                        key={axis.label}
                        className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2"
                        title={axis.tip}
                      >
                        <p className="text-xs font-medium type-label-caps text-muted-foreground">
                          {axis.label}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {axis.value}/25
                        </p>
                      </div>
                    ))}
                  </div>
                  <details
                    className="group mt-3"
                    data-testid="builder-readiness-breakdown-disclosure"
                  >
                    <summary className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/70 [&::-webkit-details-marker]:hidden">
                      <CaretRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                      View breakdown
                    </summary>
                    <div
                      className="mt-3 space-y-3"
                      data-testid="builder-readiness-breakdown"
                    >
                      <div className="rounded-2xl border border-pf-parchment/10 bg-pf-coal/20 p-2">
                        <PFQualityGauge
                          value={score.total}
                          size={112}
                          showLabel={false}
                        />
                      </div>
                      <div className="space-y-1.5">
                        {builderScoreAxes.map((axis) => (
                          <div key={axis.label} className="space-y-0.5">
                            <div className="flex justify-between text-xs">
                              <span
                                className="text-muted-foreground"
                                title={axis.tip}
                              >
                                {axis.label}
                              </span>
                              <span className="font-medium text-foreground">
                                {axis.value}/25
                              </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-muted/50">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{
                                  width: `${Math.round((axis.value / 25) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </>
              ) : (
                <>
                  <div className="mt-3 rounded-2xl border border-pf-parchment/10 bg-pf-coal/20 p-2">
                    <PFQualityGauge
                      value={score.total}
                      size={128}
                      showLabel={false}
                    />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {builderScoreAxes.map((axis) => (
                      <div key={axis.label} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground" title={axis.tip}>
                            {axis.label}
                          </span>
                          <span className="font-medium text-foreground">
                            {axis.value}/25
                          </span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-muted/50">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.round((axis.value / 25) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
            <OutputPanel
              builtPrompt={builtPrompt}
              enhancedPrompt={currentEnhancedPrompt}
              reasoningSummary={currentReasoningSummary}
              isEnhancing={isEnhancing}
              enhancePhase={enhancePhase}
              onEnhance={handleEnhance}
              onSaveVersion={handleSaveVersion}
              onSavePrompt={handleSavePrompt}
              onSaveAndSharePrompt={handleSaveAndSharePrompt}
              canSavePrompt={canSavePrompt}
              canSharePrompt={canSharePrompt}
              previewSource={previewSource}
              hasEnhancedOnce={hasCurrentEnhancedOutput}
              webSearchEnabled={webSearchEnabled}
              onWebSearchToggle={handleWebSearchToggle}
              webSearchSources={currentWebSearchSources}
              webSearchActivity={webSearchActivity}
              enhanceWorkflow={currentEnhanceWorkflow}
              enhanceIdleLabel={primaryCtaLabel}
              enhanceMetadata={currentEnhanceMetadata}
              activeVariant={effectiveActiveEnhancementVariant}
              onVariantChange={handleVariantChange}
              onPromptAccepted={trackEnhanceAccepted}
              enhancementDepth={enhancementDepth}
              rewriteStrictness={rewriteStrictness}
              onEnhancementDepthChange={handleEnhancementDepthChange}
              onRewriteStrictnessChange={handleRewriteStrictnessChange}
              ambiguityMode={ambiguityMode}
              onAmbiguityModeChange={handleAmbiguityModeChange}
              enhanceControlsMode={desktopEnhanceControlsMode}
              canResetEnhancementPreferences={canResetEnhancementPreferences}
              onResetEnhancementPreferences={
                canResetEnhancementPreferences
                  ? handleResetEnhancementPreferences
                  : undefined
              }
              preferredAcceptedFormat={preferredAcceptedFormat}
              onApplyToBuilder={handleApplyToBuilder}
              onAppendClarificationBlockToPrompt={handleAppendClarificationBlockToPrompt}
              onAppendToSessionContext={
                canManageCodexSession
                  ? handleAppendToSessionContext
                  : undefined
              }
              onEditableListSaved={handleEditableListSaved}
              onApplyEditableListToPrompt={handleApplyEditableListToPrompt}
              staleEnhancementNotice={staleEnhancementNotice}
              archivedEnhanceMetadata={archivedEnhanceMetadata}
              archivedReasoningSummary={archivedReasoningSummary}
              archivedEnhanceWorkflow={archivedEnhanceWorkflow}
              archivedWebSearchSources={archivedWebSearchSources}
              remixContext={
                remixContext
                  ? {
                    title: remixContext.parentTitle,
                    authorName: remixContext.parentAuthor,
                  }
                  : undefined
              }
            />
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-card/80 [&::-webkit-details-marker]:hidden">
                <CaretRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                Session, tips & history
              </summary>
              <div className="mt-2 space-y-3">
                <Card className="pf-panel border-border/70 bg-card/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Codex session
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sessionDrawerSummary}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleOpenSessionDrawer}
                    >
                      {isSignedIn ? "Open drawer" : "Sign in to use"}
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge
                      variant="pill"
                      tone={
                        isSignedIn
                          ? enhanceSession.threadId
                            ? "brand"
                            : "default"
                          : "default"
                      }
                      className="text-xs"
                    >
                      {isSignedIn
                        ? enhanceSession.threadId
                          ? "Thread active"
                          : "New thread"
                        : "Login required"}
                    </Badge>
                    {isSignedIn && enhanceSession.contextSummary.trim() && (
                      <Badge variant="pill" tone="brand" className="text-xs">
                        Context saved
                      </Badge>
                    )}
                    {isSignedIn && enhanceSession.latestEnhancedPrompt.trim() && (
                      <Badge variant="pill" tone="brand" className="text-xs">
                        Prompt saved
                      </Badge>
                    )}
                  </div>
                </Card>
                <Card className="pf-panel border-border/70 bg-card/80 p-3">
                  <p className="text-sm font-medium text-foreground">History</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saved versions appear in History. Open{" "}
                    <Link
                      to="/history"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Version History
                    </Link>{" "}
                    to restore prior prompts.
                  </p>
                </Card>
              </div>
            </details>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Press{" "}
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono">
                Ctrl+Enter
              </kbd>{" "}
              to enhance prompt
            </p>
          </div>
        )}
      </div>

      {/* Mobile: sticky bottom bar */}
      {isMobile && (
        <div
          className="fixed inset-x-0 bottom-[calc(var(--pf-mobile-nav-occupied-height)+1px)] z-30 border-t border-border bg-card/95 px-3 py-2 backdrop-blur-sm sm:bottom-0"
          data-testid="builder-mobile-sticky-bar"
        >
          <div className="flex items-center gap-2">
            <Badge
              variant="pill"
              tone={score.total >= 75 ? "brand" : "default"}
              className="relative h-11 min-w-16 shrink-0 justify-center overflow-hidden rounded-md px-2 text-sm font-semibold"
              aria-label={builderQualityLabel}
              title={builderQualityLabel}
            >
              <span
                className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300"
                style={{ width: `${score.total}%` }}
                aria-hidden="true"
              />
              <span className="sr-only">{builderQualityLabel}</span>
              <span className="relative" aria-hidden="true">{score.total}/100</span>
            </Badge>
            <EnhancePrimaryButton
              isEnhancing={isEnhancing}
              onEnhance={handleEnhance}
              builtPrompt={builtPrompt}
              enhancePhase={enhancePhase}
              enhanceLabel={mobileEnhanceLabel}
              size="md"
              fullWidth={false}
              className="h-11 min-w-0 flex-1"
              dataTestId="builder-mobile-enhance-button"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDrawerOpen(true)}
              className="h-11 min-w-[4.75rem] shrink-0 gap-1.5 px-2.5 text-xs"
              aria-label={`Open output preview. ${mobilePreviewLabel}.`}
              title={mobilePreviewTitle}
              data-testid="builder-mobile-preview-trigger"
            >
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span className="type-label-caps text-2xs leading-none">
                {mobilePreviewActionLabel}
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-11 w-11 shrink-0 px-0"
              onClick={() => setMobileEnhancementSettingsOpen(true)}
              aria-label="Open enhancement settings"
              title="Enhancement settings"
              data-testid="builder-mobile-settings-trigger"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="sr-only">Settings</span>
            </Button>
          </div>
        </div>
      )}

      {isMobile && (
        <MobileEnhancementSettingsSheet
          open={mobileEnhancementSettingsOpen}
          onOpenChange={setMobileEnhancementSettingsOpen}
          webSearchEnabled={webSearchEnabled}
          onWebSearchToggle={handleWebSearchToggle}
          isEnhancing={isEnhancing}
          enhancementDepth={enhancementDepth}
          rewriteStrictness={rewriteStrictness}
          ambiguityMode={ambiguityMode}
          onEnhancementDepthChange={handleEnhancementDepthChange}
          onRewriteStrictnessChange={handleRewriteStrictnessChange}
          onAmbiguityModeChange={handleAmbiguityModeChange}
          canResetPreferences={canResetEnhancementPreferences}
          onResetPreferences={
            canResetEnhancementPreferences
              ? handleResetEnhancementPreferences
              : undefined
          }
          preferredAcceptedFormat={preferredAcceptedFormat}
          showCodexSession={canManageCodexSession}
          codexSessionSummary={sessionDrawerSummary}
          onOpenCodexSession={handleOpenSessionDrawerFromMobileSettings}
        />
      )}

      {/* Mobile: output drawer */}
      {isMobile && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>
                {hasCurrentEnhancedOutput
                  ? "Enhanced prompt"
                  : builtPrompt
                    ? "Draft prompt"
                    : "No preview yet"}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                Review, copy, and save your current prompt output.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-auto flex-1">
              <OutputPanel
                builtPrompt={builtPrompt}
                enhancedPrompt={currentEnhancedPrompt}
                reasoningSummary={currentReasoningSummary}
                enhanceWorkflow={currentEnhanceWorkflow}
                isEnhancing={isEnhancing}
                enhancePhase={enhancePhase}
                onEnhance={handleEnhance}
                onSaveVersion={handleSaveVersion}
                onSavePrompt={handleSavePrompt}
                onSaveAndSharePrompt={handleSaveAndSharePrompt}
                canSavePrompt={canSavePrompt}
                canSharePrompt={canSharePrompt}
                previewSource={previewSource}
                hasEnhancedOnce={hasCurrentEnhancedOutput}
                webSearchEnabled={webSearchEnabled}
                enhanceIdleLabel={primaryCtaLabel}
                enhanceMetadata={currentEnhanceMetadata}
                activeVariant={effectiveActiveEnhancementVariant}
                onVariantChange={handleVariantChange}
                onPromptAccepted={trackEnhanceAccepted}
                onApplyToBuilder={handleApplyToBuilder}
                onAppendClarificationBlockToPrompt={handleAppendClarificationBlockToPrompt}
                onAppendToSessionContext={
                  canManageCodexSession
                    ? handleAppendToSessionContext
                    : undefined
                }
                onEditableListSaved={handleEditableListSaved}
                onApplyEditableListToPrompt={handleApplyEditableListToPrompt}
                enhancementSettingsSummary={mobileEnhancementSummary}
                onEditEnhancementSettings={handleEditMobileEnhancementSettings}
                staleEnhancementNotice={staleEnhancementNotice}
                archivedEnhanceMetadata={archivedEnhanceMetadata}
                archivedReasoningSummary={archivedReasoningSummary}
                archivedEnhanceWorkflow={archivedEnhanceWorkflow}
                archivedWebSearchSources={archivedWebSearchSources}
                announceStatus={false}
                // Enhancement depth/strictness/ambiguity controls omitted — hideEnhanceButton hides the section they render in
                hideEnhanceButton
                remixContext={
                  remixContext
                    ? {
                      title: remixContext.parentTitle,
                      authorName: remixContext.parentAuthor,
                    }
                    : undefined
                }
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <CodexSessionDrawer
        open={isSignedIn && sessionDrawerOpen}
        onOpenChange={setSessionDrawerOpen}
        session={enhanceSession}
        isEnhancing={isEnhancing}
        isMobile={isMobile}
        currentPromptText={currentPreviewPrompt}
        onUpdateSession={handleUpdateEnhanceSession}
        onResetSession={handleResetEnhanceSession}
        onUseCurrentPrompt={handleUseCurrentPromptForSession}
      />

      {/* Add bottom padding on mobile for sticky bar */}
      {isMobile && <div className="h-[var(--pf-builder-mobile-sticky-reserved-height)] sm:h-28" />}
    </PageShell>
  );
};

export default Index;
