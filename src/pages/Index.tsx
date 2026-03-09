import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { PromptInput } from "@/components/PromptInput";
import { BuilderHeroInput } from "@/components/BuilderHeroInput";
import { BuilderAdjustDetails } from "@/components/BuilderAdjustDetails";
import { BuilderSourcesAdvanced } from "@/components/BuilderSourcesAdvanced";
import { BuilderTabs } from "@/components/BuilderTabs";
import { CodexSessionDrawer } from "@/components/CodexSessionDrawer";
import { ContextPanel } from "@/components/ContextPanel";
import { ToneControls } from "@/components/ToneControls";
import { QualityScore } from "@/components/QualityScore";
import {
  OutputPanel,
  type EnhancePhase,
  type OutputPreviewSource,
  type ApplyToBuilderUpdate,
} from "@/components/OutputPanel";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import {
  inferBuilderFields,
  streamEnhance,
  type AIClientError,
  type EnhanceThreadOptions,
} from "@/lib/ai-client";
import { createCodexSession, type CodexSession } from "@/lib/codex-session";
import {
  applyInferenceUpdates,
  clearAiOwnedFields,
  createFieldOwnershipFromConfig,
  inferBuilderFieldsLocally,
  listInferenceFieldsFromUpdates,
  markOwnershipFields,
  type BuilderFieldOwnershipMap,
  type BuilderSuggestionChip,
} from "@/lib/builder-inference";
import {
  getSectionHealth,
  type SectionHealthState,
} from "@/lib/section-health";
import {
  buildPrompt,
  defaultConfig,
  hasBuilderFieldInput,
  hasPromptInput,
  normalizeConstraintSelections,
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
  builderRedesignFlags,
  launchExperimentFlags,
} from "@/lib/feature-flags";
import { trackBuilderEvent } from "@/lib/telemetry";
import {
  parseEnhanceMetadata,
  type EnhanceMetadata,
} from "@/lib/enhance-metadata";
import {
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
import { brandCopy } from "@/lib/brand-copy";
import {
  getHeroCopyVariant,
  getLaunchExperimentAssignments,
  getPrimaryCtaVariantLabel,
} from "@/lib/launch-experiments";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/base/accordion";
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
import { Switch } from "@/components/base/switch";
import type { Icon as IconType } from "@phosphor-icons/react";
import { UI_STATUS_SURFACE_CLASSES } from "@/lib/ui-status";
import { PFQualityGauge } from "@/components/fantasy/PFQualityGauge";
import {
  CaretRight,
  ChartBar as BarChart3,
  Chat as MessageSquare,
  Check,
  CheckCircle as CheckCircle2,
  CircleDashed,
  Crosshair as Target,
  Eye,
  Gauge,
  Globe,
  Layout as LayoutIcon,
  Sparkle as Sparkles,
  SpinnerGap as Loader2,
  X,
} from "@phosphor-icons/react";

const healthBadgeStyles: Record<
  SectionHealthState,
  { label: string; className: string; icon: IconType }
> = {
  empty: {
    label: "Empty",
    className: "border-border/80 bg-muted/50 text-muted-foreground",
    icon: CircleDashed,
  },
  in_progress: {
    label: "In progress",
    className: UI_STATUS_SURFACE_CLASSES.info,
    icon: Gauge,
  },
  complete: {
    label: "Complete",
    className: UI_STATUS_SURFACE_CLASSES.success,
    icon: CheckCircle2,
  },
};

function SectionHealthBadge({ state }: { state: SectionHealthState }) {
  const meta = healthBadgeStyles[state];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}
      title={meta.label}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}

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
const ENHANCED_PROMPT_SOURCES_SEPARATOR = /\n---\n\s*Sources:\s*\n/i;
const ENHANCED_PROMPT_JSON_ARTIFACT_PATTERN = /"enhanced_prompt"\s*:/i;
const ENHANCED_PROMPT_CODE_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

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

const Index = () => {
  const isBuilderRedesignPhase1 = builderRedesignFlags.builderRedesignPhase1;
  const isBuilderRedesignPhase2 =
    isBuilderRedesignPhase1 && builderRedesignFlags.builderRedesignPhase2;
  const isBuilderRedesignPhase3 =
    isBuilderRedesignPhase1 && builderRedesignFlags.builderRedesignPhase3;
  const [searchParams, setSearchParams] = useSearchParams();
  const remixId = searchParams.get("remix");
  const presetId = searchParams.get("preset");
  const remixLoadToken = useRef(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [heroCollapsed, setHeroCollapsed] = useState(() => {
    try {
      return localStorage.getItem("pf-hero-dismissed") === "1";
    } catch {
      return false;
    }
  });
  const [openSections, setOpenSections] = useState<BuilderSection[]>([
    "builder",
  ]);
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
  const enhanceStartedAt = useRef<number | null>(null);
  const enhancePending = useRef(false);
  const enhanceAbortController = useRef<AbortController | null>(null);
  const enhanceStreamToken = useRef(0);
  const enhanceOutputUsed = useRef(false);
  const [suggestionChips, setSuggestionChips] = useState<
    BuilderSuggestionChip[]
  >([]);
  const [isInferringSuggestions, setIsInferringSuggestions] = useState(false);
  const [hasInferenceError, setHasInferenceError] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    () => getUserPreferences().webSearchEnabled,
  );
  const [webSearchSources, setWebSearchSources] = useState<string[]>([]);
  const [webSearchActivity, setWebSearchActivity] = useState<WebSearchActivity>(
    IDLE_WEB_SEARCH_ACTIVITY,
  );
  const [reasoningSummary, setReasoningSummary] = useState("");
  const [enhanceMetadata, setEnhanceMetadata] = useState<EnhanceMetadata | null>(null);
  const [intentOverride, setIntentOverride] = useState<IntentRoute | null>(null);
  const [enhanceSession, setEnhanceSession] = useState<CodexSession>(() =>
    createCodexSession(),
  );
  const [fieldOwnership, setFieldOwnership] =
    useState<BuilderFieldOwnershipMap>(() =>
      createFieldOwnershipFromConfig(defaultConfig),
    );
  const { toast } = useToast();
  const isMobile = useIsMobile();

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

  const launchAssignments = useMemo(() => getLaunchExperimentAssignments(), []);
  const heroCopyVariant = launchExperimentFlags.launchHeroCopyExperiment
    ? launchAssignments.heroCopy
    : "control";
  const primaryCtaVariant = launchExperimentFlags.launchPrimaryCtaExperiment
    ? launchAssignments.primaryCta
    : "control";
  const heroCopy = useMemo(
    () => getHeroCopyVariant(heroCopyVariant),
    [heroCopyVariant],
  );
  const primaryCtaLabel = useMemo(
    () => getPrimaryCtaVariantLabel(primaryCtaVariant),
    [primaryCtaVariant],
  );

  const tipsWithOwnership = useMemo(
    () => scorePrompt(config, fieldOwnership).tips,
    [config, fieldOwnership],
  );

  const clearEnhanceTimers = useCallback(() => {
    enhancePhaseTimers.current.forEach((timer) => window.clearTimeout(timer));
    enhancePhaseTimers.current = [];
  }, []);

  const resetEnhanceSessionState = useCallback(() => {
    clearEnhanceTimers();
    enhancePending.current = false;
    enhanceStartedAt.current = null;
    enhanceStreamToken.current += 1;
    enhanceAbortController.current?.abort();
    enhanceAbortController.current = null;
    setSessionDrawerOpen(false);
    setEnhanceSession(createCodexSession());
    setReasoningSummary("");
    setEnhanceMetadata(null);
    setWebSearchSources([]);
    setWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY);
    setIsEnhancing(false);
    setEnhancePhase("idle");
  }, [clearEnhanceTimers, setIsEnhancing]);

  useEffect(() => {
    if (hasTrackedBuilderLoaded.current) return;
    hasTrackedBuilderLoaded.current = true;
    trackBuilderEvent("builder_loaded", {
      isMobile,
      isSignedIn,
      redesignPhase1: isBuilderRedesignPhase1,
      redesignPhase2: isBuilderRedesignPhase2,
      redesignPhase3: isBuilderRedesignPhase3,
      hasRemixParam: Boolean(remixId),
      hasPresetParam: Boolean(presetId),
      heroCopyExperimentEnabled: launchExperimentFlags.launchHeroCopyExperiment,
      primaryCtaExperimentEnabled:
        launchExperimentFlags.launchPrimaryCtaExperiment,
      heroCopyVariant,
      primaryCtaVariant,
    });
  }, [
    isMobile,
    isSignedIn,
    isBuilderRedesignPhase1,
    isBuilderRedesignPhase2,
    isBuilderRedesignPhase3,
    remixId,
    presetId,
    heroCopyVariant,
    primaryCtaVariant,
  ]);

  useEffect(() => {
    const restoredPrompt = consumeRestoredVersionPrompt();
    if (!restoredPrompt) return;
    resetEnhanceSessionState();
    setEnhancedPrompt(restoredPrompt);
    setReasoningSummary("");
    toast({ title: "Version restored", description: "Restored from History." });
    if (isMobile) {
      setDrawerOpen(true);
    }
  }, [isMobile, resetEnhanceSessionState, setEnhancedPrompt, toast]);

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
      if (isBuilderRedesignPhase3) {
        const fields = listInferenceFieldsFromUpdates(updates);
        if (fields.length > 0) {
          setFieldOwnership((previous) =>
            markOwnershipFields(previous, fields, "user"),
          );
          trackBuilderEvent("builder_field_manual_override", {
            fields: fields.join(","),
          });
        }
      }

      updateConfig(updates);
    },
    [isBuilderRedesignPhase3, updateConfig],
  );

  const handleOpenSessionDrawer = useCallback(() => {
    if (!isSignedIn) {
      toast({
        title: "Sign in required",
        description: "Sign in to manage Codex session context.",
        variant: "destructive",
      });
      return;
    }
    setSessionDrawerOpen(true);
  }, [isSignedIn, toast]);

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

  const handleUseCurrentPromptForSession = useCallback(() => {
    const promptSnapshot = (enhancedPrompt || builtPrompt).trim();
    if (!promptSnapshot) return;
    setEnhanceSession((previous) =>
      createCodexSession({
        ...previous,
        latestEnhancedPrompt: promptSnapshot,
        updatedAt: Date.now(),
      }),
    );
  }, [builtPrompt, enhancedPrompt]);

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
      if (enhancedPrompt.trim()) {
        if (enhanceOutputUsed.current) {
          trackBuilderEvent("builder_enhance_accepted", {
            promptChars: enhancedPrompt.length,
          });
        }
        trackBuilderEvent("builder_enhance_rerun", {
          previousPromptChars: enhancedPrompt.length,
        });
      }
      enhanceOutputUsed.current = false;
      trackBuilderEvent("builder_enhance_clicked", {
        promptChars: promptForEnhance.length,
        redesignPhase1: isBuilderRedesignPhase1,
        hasExistingEnhancedPrompt: Boolean(enhancedPrompt.trim()),
      });
      clearEnhanceTimers();
      setEnhancePhase("starting");
      setIsEnhancing(true);
      enhancePending.current = false;
      setEnhancedPrompt("");
      setReasoningSummary("");
      setEnhanceMetadata(null);
      setWebSearchSources([]);
      setWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY);

      if (isMobile) setDrawerOpen(true);

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
      const applyEnhancedOutput = (
        nextOutput: string,
        clearSourcesWhenMissing = false,
      ) => {
        const { promptText, sources } =
          splitEnhancedPromptAndSources(nextOutput);
        if (sources.length > 0) {
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
              setEnhanceMetadata(parsed);
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
          trackBuilderEvent("builder_enhance_completed", {
            success: true,
            durationMs,
            outputChars: accumulated.length,
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
          if (error.code === "request_aborted") return;

          const errorMessage = error.message;
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
    clearEnhanceTimers,
    config,
    enhanceSession,
    enhancedPrompt,
    isBuilderRedesignPhase1,
    isEnhancing,
    isMobile,
    setEnhancedPrompt,
    setIsEnhancing,
    setReasoningSummary,
    toast,
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
    }) => {
      enhanceOutputUsed.current = true;
      try {
        const result = await savePrompt({
          title: input.name,
          description: input.description,
          tags: input.tags,
          category: input.category,
          remixNote: input.remixNote,
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
        if (remixContext) {
          handleClearRemix();
        }
      } catch (error) {
        toast({
          title: "Failed to save prompt",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [savePrompt, toast, remixContext, handleClearRemix],
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
    }) => {
      enhanceOutputUsed.current = true;
      if (!isSignedIn) {
        toast({
          title: "Sign in required",
          description: "Sign in to share prompts.",
          variant: "destructive",
        });
        return;
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
        if (remixContext) {
          handleClearRemix();
        }
      } catch (error) {
        toast({
          title: "Failed to save & share prompt",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [isSignedIn, saveAndSharePrompt, toast, remixContext, handleClearRemix],
  );

  const handlePromptUsed = useCallback(() => {
    enhanceOutputUsed.current = true;
  }, []);

  const detectedIntent: IntentRoute | null = useMemo(() => {
    const ctx = enhanceMetadata?.detectedContext;
    // Prefer the backend's authoritative primary_intent field if available
    const primaryIntent = ctx?.primaryIntent;
    if (typeof primaryIntent === "string" && isIntentRoute(primaryIntent)) return primaryIntent;
    // Fall back to legacy intent[0] mapping
    const raw = ctx?.intent?.[0];
    const intentMap: Record<string, IntentRoute> = {
      creative: "brainstorm",
      analytical: "analysis",
      instructional: "planning",
      conversational: "brainstorm",
      extraction: "extraction",
      coding: "code",
      reasoning: "analysis",
    };
    if (typeof raw === "string" && intentMap[raw]) return intentMap[raw];
    if (typeof raw === "string" && isIntentRoute(raw)) return raw;
    return null;
  }, [enhanceMetadata]);

  const handleIntentOverrideChange = useCallback((intent: IntentRoute | null) => {
    const previousOverride = intentOverride;
    setIntentOverride(intent);
    if (intent && intent !== detectedIntent) {
      trackBuilderEvent("builder_enhance_intent_overridden", {
        fromIntent: previousOverride || detectedIntent || "auto",
        toIntent: intent,
      });
    }
  }, [intentOverride, detectedIntent]);

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

  const handleApplyToBuilder = useCallback((updates: ApplyToBuilderUpdate) => {
    const configUpdates: Partial<typeof config> = {};
    if (updates.role) configUpdates.customRole = updates.role;
    if (updates.context) configUpdates.context = updates.context;
    if (updates.format) configUpdates.customFormat = updates.format;
    if (updates.constraints) configUpdates.customConstraint = updates.constraints;
    updateConfig(configUpdates);
  }, [updateConfig]);

  // Keyboard shortcut: Ctrl+Enter to enhance
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

  // Status indicators for accordion triggers
  const sourceCount = config.contextConfig.sources.length;
  const sectionHealth = getSectionHealth(config, score.total);
  const selectedRole = config.customRole || config.role;
  const displayPrompt = enhancedPrompt || builtPrompt;
  const sessionDrawerSummary = useMemo(() => {
    if (!isSignedIn) {
      return "Sign in to manage the Codex session and carry supplemental context across turns.";
    }
    if (enhanceSession.contextSummary.trim()) {
      return "Outside context is ready to carry into the next Codex turn.";
    }
    if (enhanceSession.threadId) {
      return "This builder is already attached to a Codex thread.";
    }
    return "Open the drawer to add supplemental context before the next enhancement pass.";
  }, [enhanceSession.contextSummary, enhanceSession.threadId, isSignedIn]);
  const hasBuiltPrompt = builtPrompt.trim().length > 0;
  const hasOriginalPromptInput = config.originalPrompt.trim().length > 0;
  const hasBuilderDrivenInput = hasBuilderFieldInput(config);
  const hasEnhancedOnce = enhancedPrompt.trim().length > 0;
  const allSectionsComplete =
    sectionHealth.builder === "complete" &&
    sectionHealth.context === "complete" &&
    sectionHealth.tone === "complete";
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
    hasEnhancedOnce ||
    hasDetailSelections ||
    hasSourceOrAdvancedSelections ||
    showAdvancedControls ||
    isAdjustDetailsOpen ||
    isSourcesAdvancedOpen;
  const showEnhanceFirstCard =
    !hasStartedBuilderFlow && (isBuilderRedesignPhase1 || !allSectionsComplete);
  const shouldShowAdvancedControls =
    showAdvancedControls ||
    hasEnhancedOnce ||
    hasDetailSelections ||
    hasSourceOrAdvancedSelections;
  const previewSource: OutputPreviewSource = hasEnhancedOnce
    ? "enhanced"
    : hasBuiltPrompt
      ? hasBuilderDrivenInput
        ? "builder_fields"
        : hasOriginalPromptInput
          ? "prompt_text"
          : "builder_fields"
      : "empty";
  const hasUnenhancedPreview =
    !hasEnhancedOnce && builtPrompt.trim().length > 0;
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
  const enhanceLiveMessage =
    enhancePhase === "starting"
      ? "Enhancement started."
      : enhancePhase === "streaming"
        ? "Enhancement in progress."
        : enhancePhase === "settling"
          ? "Enhancement finalizing."
          : enhancePhase === "done"
            ? "Enhancement complete."
            : "";
  const mobilePreviewText = useMemo(() => {
    const trimmed = displayPrompt.trim();
    if (!trimmed) {
      return "Preview updates as you build.";
    }
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 1)
      .join(" ");
  }, [displayPrompt]);
  const mobilePreviewLabel = hasEnhancedOnce
    ? "Enhanced output"
    : displayPrompt.trim()
      ? "Built prompt"
      : "Live preview";
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

  useEffect(() => {
    if (hasTrackedFirstInput.current) return;
    const trimmedPrompt = config.originalPrompt.trim();
    if (!trimmedPrompt) return;

    hasTrackedFirstInput.current = true;
    trackBuilderEvent("builder_first_input", {
      promptChars: trimmedPrompt.length,
      redesignPhase1: isBuilderRedesignPhase1,
    });
  }, [config.originalPrompt, isBuilderRedesignPhase1]);

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
    if (isBuilderRedesignPhase3) return;
    setSuggestionChips([]);
    setIsInferringSuggestions(false);
    setHasInferenceError(false);
    setFieldOwnership(createFieldOwnershipFromConfig(config));
  }, [isBuilderRedesignPhase3, config]);

  useEffect(() => {
    if (!isBuilderRedesignPhase3) return;
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
  }, [isBuilderRedesignPhase3, config]);

  useEffect(() => {
    if (!isBuilderRedesignPhase1) return;

    if (
      hasEnhancedOnce ||
      hasDetailSelections ||
      hasSourceOrAdvancedSelections
    ) {
      persistedSetShowAdvancedControls(true);
    }
    if (hasDetailSelections || hasEnhancedOnce) {
      setIsAdjustDetailsOpen(true);
    }
    if (hasSourceOrAdvancedSelections || hasEnhancedOnce) {
      setIsSourcesAdvancedOpen(true);
    }
  }, [
    isBuilderRedesignPhase1,
    hasEnhancedOnce,
    hasDetailSelections,
    hasSourceOrAdvancedSelections,
    persistedSetShowAdvancedControls,
  ]);

  useEffect(() => {
    if (isSignedIn || !sessionDrawerOpen) return;
    setSessionDrawerOpen(false);
  }, [isSignedIn, sessionDrawerOpen]);

  useEffect(() => {
    if (!isBuilderRedesignPhase1) return;
    if (!isAdjustDetailsOpen || hasTrackedZone2Opened.current) return;

    hasTrackedZone2Opened.current = true;
    trackBuilderEvent("builder_zone2_opened", {
      selectedRole: Boolean(selectedRole),
      formatCount: config.format.length,
      constraintCount: config.constraints.length,
      hasExamples: Boolean(config.examples.trim()),
    });
  }, [
    isBuilderRedesignPhase1,
    isAdjustDetailsOpen,
    selectedRole,
    config.format.length,
    config.constraints.length,
    config.examples,
  ]);

  useEffect(() => {
    if (!isBuilderRedesignPhase1) return;
    if (!isSourcesAdvancedOpen || hasTrackedZone3Opened.current) return;

    hasTrackedZone3Opened.current = true;
    trackBuilderEvent("builder_zone3_opened", {
      sourceCount: config.contextConfig.sources.length,
      hasProjectNotes: Boolean(config.contextConfig.projectNotes.trim()),
      databaseCount: config.contextConfig.databaseConnections.length,
      ragEnabled: config.contextConfig.rag.enabled,
    });
  }, [
    isBuilderRedesignPhase1,
    isSourcesAdvancedOpen,
    config.contextConfig.sources.length,
    config.contextConfig.projectNotes,
    config.contextConfig.databaseConnections.length,
    config.contextConfig.rag.enabled,
  ]);

  useEffect(() => {
    if (!isBuilderRedesignPhase3) {
      suggestionLoadToken.current += 1;
      return;
    }
    const prompt = config.originalPrompt.trim();
    if (prompt.length < 24) {
      suggestionLoadToken.current += 1;
      setSuggestionChips([]);
      setHasInferenceError(false);
      setIsInferringSuggestions(false);
      return;
    }

    const token = ++suggestionLoadToken.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        setIsInferringSuggestions(true);
        try {
          const remote = await inferBuilderFields({
            prompt,
            currentFields: buildInferenceCurrentFields(config),
            lockMetadata: fieldOwnership,
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
            setSuggestionChips(
              inferBuilderFieldsLocally(prompt, config).suggestionChips,
            );
          }
          setHasInferenceError(false);
        } catch {
          if (token !== suggestionLoadToken.current) return;
          setSuggestionChips(
            inferBuilderFieldsLocally(prompt, config).suggestionChips,
          );
          setHasInferenceError(true);
        } finally {
          if (token === suggestionLoadToken.current) {
            setIsInferringSuggestions(false);
          }
        }
      })();
    }, 450);

    return () => {
      window.clearTimeout(timer);
      suggestionLoadToken.current += 1;
    };
  }, [isBuilderRedesignPhase3, config, fieldOwnership, updateConfig]);

  const openAndFocusSection = useCallback(
    (section: BuilderSection) => {
      if (isBuilderRedesignPhase1) {
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
        return;
      }
      setOpenSections((prev) =>
        prev.includes(section) ? prev : [...prev, section],
      );
      window.requestAnimationFrame(() => {
        document.getElementById(`accordion-${section}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    },
    [isBuilderRedesignPhase1, persistedSetShowAdvancedControls],
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
          <h1 className="pf-text-display mb-1 text-[1.75rem] font-bold tracking-tight text-pf-parchment/95 sm:mb-2 sm:text-3xl md:text-4xl">
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
        <div className="space-y-3 sm:space-y-4">
          {isBuilderRedesignPhase1 ? (
            <>
              <BuilderHeroInput
                value={config.originalPrompt}
                onChange={(value) => updateConfig({ originalPrompt: value })}
                onClear={handleClearPrompt}
                onResetAll={handleResetAll}
                phase3Enabled={isBuilderRedesignPhase3}
                suggestionChips={suggestionChips}
                isInferringSuggestions={isInferringSuggestions}
                hasInferenceError={hasInferenceError}
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
                        Reveal advanced settings when you are ready to refine.
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
                    webSearchEnabled={webSearchEnabled}
                    onToggleWebSearch={handleWebSearchToggle}
                    isEnhancing={isEnhancing}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <PromptInput
                value={config.originalPrompt}
                onChange={(v) => updateConfig({ originalPrompt: v })}
                onClear={handleClearPrompt}
                onResetAll={handleResetAll}
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

              <Accordion
                type="multiple"
                value={openSections}
                onValueChange={(value) =>
                  setOpenSections(value as BuilderSection[])
                }
                className="space-y-1"
              >
                <AccordionItem
                  id="accordion-builder"
                  value="builder"
                  className="border rounded-lg px-3"
                >
                  <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                    <span className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-muted-foreground" />
                      Builder
                    </span>
                    <span className="ml-auto mr-2 flex items-center gap-1.5">
                      {selectedRole && (
                        <Badge variant="modern" className="max-w-45 text-xs">
                          <span className="type-wrap-safe">{selectedRole}</span>
                        </Badge>
                      )}
                      <SectionHealthBadge state={sectionHealth.builder} />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <BuilderTabs config={config} onUpdate={updateConfig} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  id="accordion-context"
                  value="context"
                  className="border rounded-lg px-3"
                >
                  <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                    <span className="flex items-center gap-2">
                      <LayoutIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      Context & Sources
                    </span>
                    <span className="ml-auto mr-2 flex items-center gap-1.5">
                      {sourceCount > 0 && (
                        <Badge variant="modern" className="text-xs">
                          {sourceCount} src
                        </Badge>
                      )}
                      <SectionHealthBadge state={sectionHealth.context} />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ContextPanel
                      contextConfig={config.contextConfig}
                      onUpdateSources={updateContextSources}
                      onUpdateDatabaseConnections={updateDatabaseConnections}
                      onUpdateRag={updateRagParameters}
                      onUpdateStructured={updateContextStructured}
                      onUpdateInterview={updateContextInterview}
                      onUpdateProjectNotes={updateProjectNotes}
                      onToggleDelimiters={toggleDelimiters}
                      webSearchEnabled={webSearchEnabled}
                      onToggleWebSearch={handleWebSearchToggle}
                      isEnhancing={isEnhancing}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  id="accordion-tone"
                  value="tone"
                  className="border rounded-lg px-3"
                >
                  <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                      Tone & Style
                    </span>
                    <span className="ml-auto mr-2 flex items-center gap-1.5">
                      {config.tone && (
                        <Badge variant="modern" className="text-xs">
                          {config.tone}
                        </Badge>
                      )}
                      <SectionHealthBadge state={sectionHealth.tone} />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ToneControls
                      tone={config.tone}
                      complexity={config.complexity}
                      onUpdate={updateConfig}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  id="accordion-quality"
                  value="quality"
                  className="border rounded-lg px-3"
                >
                  <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                      Quality Score
                    </span>
                    <span className="ml-auto mr-2 flex items-center gap-1.5">
                      <Badge
                        variant="pill"
                        tone={score.total >= 75 ? "brand" : "default"}
                        className="text-xs"
                      >
                        {score.total}/100
                      </Badge>
                      <SectionHealthBadge state={sectionHealth.quality} />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <QualityScore score={score} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}
        </div>

        {/* Right: Output — inline on desktop, drawer on mobile */}
        {!isMobile && (
          <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            {isBuilderRedesignPhase1 && (
              <Card className="pf-panel mb-3 border-border/70 bg-card/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      Quality signal
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {tipsWithOwnership?.[0] ||
                        "Add context and constraints to improve quality."}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="pill"
                      tone={score.total >= 75 ? "brand" : "default"}
                      className="text-xs"
                    >
                      {score.total}/100
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-pf-parchment/10 bg-pf-coal/20 p-2">
                  <PFQualityGauge
                    value={score.total}
                    size={128}
                    showLabel={false}
                  />
                </div>
              </Card>
            )}
            <OutputPanel
              builtPrompt={builtPrompt}
              enhancedPrompt={enhancedPrompt}
              reasoningSummary={reasoningSummary}
              isEnhancing={isEnhancing}
              enhancePhase={enhancePhase}
              onEnhance={handleEnhance}
              onSaveVersion={saveVersion}
              onSavePrompt={handleSavePrompt}
              onSaveAndSharePrompt={handleSaveAndSharePrompt}
              canSavePrompt={canSavePrompt}
              canSharePrompt={canSharePrompt}
              previewSource={previewSource}
              hasEnhancedOnce={hasEnhancedOnce}
              phase2Enabled={isBuilderRedesignPhase2}
              webSearchEnabled={webSearchEnabled}
              onWebSearchToggle={handleWebSearchToggle}
              webSearchSources={webSearchSources}
              webSearchActivity={webSearchActivity}
              enhanceIdleLabel={primaryCtaLabel}
              enhanceMetadata={enhanceMetadata}
              onPromptUsed={handlePromptUsed}
              enhancementDepth={enhancementDepth}
              rewriteStrictness={rewriteStrictness}
              onEnhancementDepthChange={handleEnhancementDepthChange}
              onRewriteStrictnessChange={handleRewriteStrictnessChange}
              ambiguityMode={ambiguityMode}
              onAmbiguityModeChange={handleAmbiguityModeChange}
              onApplyToBuilder={handleApplyToBuilder}
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
                  <p className="text-sm font-medium text-foreground">
                    Next best action
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {!hasEnhancedOnce
                      ? canSharePrompt
                        ? `Preview is ready to copy, save, or share. ${primaryCtaLabel} to compare changes and get AI refinement suggestions.`
                        : `Preview is ready to copy or save. Sign in to share, or ${primaryCtaLabel} to compare changes and get AI refinement suggestions.`
                      : (refineSuggestions[0]?.description ??
                        "Use Improve this result suggestions to keep iterating.")}
                  </p>
                </Card>
                {webSearchSources.length > 0 && (
                  <Card className="pf-panel border-border/70 bg-card/80 p-3">
                    <p className="text-sm font-medium text-foreground">
                      Recent web sources
                    </p>
                    <ul className="mt-2 space-y-1">
                      {webSearchSources.slice(0, 3).map((source, index) => (
                        <li
                          key={`${source}-${index}`}
                          className="text-xs text-muted-foreground line-clamp-2 break-all"
                        >
                          {source}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
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
              to enhance
            </p>
          </div>
        )}
      </div>

      {/* Mobile: sticky bottom bar */}
      {isMobile && (
        <div
          className="fixed inset-x-0 bottom-[calc(4.375rem+env(safe-area-inset-bottom)+1px)] z-30 border-t border-border bg-card/95 px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:bottom-0"
          data-testid="builder-mobile-sticky-bar"
        >
          {/* Row 1: Score + Enhance (primary actions) */}
          <div className="flex items-center gap-2">
            <Badge
              variant="pill"
              tone={score.total >= 75 ? "brand" : "default"}
              className="relative h-10 min-w-16 justify-center overflow-hidden rounded-md px-2 text-sm font-semibold"
            >
              <span
                className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300"
                style={{ width: `${score.total}%` }}
              />
              <span className="relative">{score.total}/100</span>
            </Badge>
            <Button
              variant="primary"
              size="md"
              onClick={handleEnhance}
              disabled={isEnhancing || !builtPrompt}
              className="signature-enhance-button h-10 min-w-0 flex-1 gap-2"
              data-phase={enhancePhase}
              data-testid="builder-mobile-enhance-button"
            >
              {isEnhancing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mobileEnhanceLabel}
                </>
              ) : (
                <>
                  {enhancePhase === "done" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {mobileEnhanceLabel}
                </>
              )}
            </Button>
          </div>

          {/* Row 2: Preview trigger + Web toggle (secondary) */}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="interactive-chip flex-1 min-h-9 rounded-lg border border-border/80 bg-background/70 px-3 py-1.5 text-left"
              aria-label="Open output preview"
              data-testid="builder-mobile-preview-trigger"
            >
              <div className="type-label-caps flex items-center gap-1.5 text-[0.7rem] font-medium text-foreground/85">
                <Eye className="h-3.5 w-3.5" />
                {mobilePreviewLabel}
              </div>
              <p className="mt-0.5 truncate text-[0.7rem] leading-4 text-muted-foreground">
                {mobilePreviewText}
              </p>
            </button>
            <label
              className="flex min-h-9 items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 text-xs text-muted-foreground cursor-pointer select-none"
              data-testid="builder-mobile-web-toggle"
            >
              <Switch
                checked={webSearchEnabled}
                onCheckedChange={handleWebSearchToggle}
                disabled={isEnhancing}
                aria-label="Enable web search during enhancement"
              />
              <Globe className="h-3.5 w-3.5" />
              <span>Web</span>
            </label>
          </div>
        </div>
      )}

      {/* Mobile: output drawer */}
      {isMobile && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>
                {enhancedPrompt
                  ? "Enhanced Prompt"
                  : builtPrompt
                    ? "Built Prompt"
                    : "Preview"}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                Review, copy, and save your current prompt output.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-auto flex-1">
              <OutputPanel
                builtPrompt={builtPrompt}
                enhancedPrompt={enhancedPrompt}
                reasoningSummary={reasoningSummary}
                isEnhancing={isEnhancing}
                enhancePhase={enhancePhase}
                onEnhance={handleEnhance}
                onSaveVersion={saveVersion}
                onSavePrompt={handleSavePrompt}
                onSaveAndSharePrompt={handleSaveAndSharePrompt}
                canSavePrompt={canSavePrompt}
                canSharePrompt={canSharePrompt}
                previewSource={previewSource}
                hasEnhancedOnce={hasEnhancedOnce}
                phase2Enabled={isBuilderRedesignPhase2}
                enhanceIdleLabel={primaryCtaLabel}
                enhanceMetadata={enhanceMetadata}
                onPromptUsed={handlePromptUsed}
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
        currentPromptText={displayPrompt}
        onUpdateSession={handleUpdateEnhanceSession}
        onResetSession={handleResetEnhanceSession}
        onUseCurrentPrompt={handleUseCurrentPromptForSession}
      />

      {/* Add bottom padding on mobile for sticky bar */}
      {isMobile && <div className="h-32 sm:h-28" />}
    </PageShell>
  );
};

export default Index;
