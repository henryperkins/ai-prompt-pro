import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { PromptInput } from "@/components/PromptInput";
import { BuilderHeroInput } from "@/components/BuilderHeroInput";
import { BuilderAdjustDetails } from "@/components/BuilderAdjustDetails";
import { BuilderSourcesAdvanced } from "@/components/BuilderSourcesAdvanced";
import { BuilderTabs } from "@/components/BuilderTabs";
import { ContextPanel } from "@/components/ContextPanel";
import { ToneControls } from "@/components/ToneControls";
import { QualityScore } from "@/components/QualityScore";
import { OutputPanel, type EnhancePhase } from "@/components/OutputPanel";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import {
  inferBuilderFields,
  streamEnhance,
  type AIClientError,
  type EnhanceThreadOptions,
} from "@/lib/ai-client";
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
import { getSectionHealth, type SectionHealthState } from "@/lib/section-health";
import { buildPrompt, defaultConfig, hasPromptInput } from "@/lib/prompt-builder";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { loadPost, loadProfilesByIds } from "@/lib/community";
import { consumeRestoredVersionPrompt } from "@/lib/history-restore";
import { builderRedesignFlags, launchExperimentFlags } from "@/lib/feature-flags";
import { trackBuilderEvent } from "@/lib/telemetry";
import { templates } from "@/lib/templates";
import { getUserPreferences, setUserPreference } from "@/lib/user-preferences";
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
} from "@/components/base/primitives/accordion";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/base/drawer";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Card } from "@/components/base/primitives/card";
import { ToastAction } from "@/components/base/primitives/toast";
import { Switch } from "@/components/base/primitives/switch";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Loader2,
  Eye,
  Target,
  Layout as LayoutIcon,
  MessageSquare,
  BarChart3,
  Check,
  CircleDashed,
  Gauge,
  CheckCircle2,
  X,
  Globe,
} from "lucide-react";
import { UI_STATUS_SURFACE_CLASSES } from "@/lib/ui-status";
import { PFQualityGauge } from "@/components/fantasy/PFQualityGauge";

const healthBadgeStyles: Record<
  SectionHealthState,
  { label: string; className: string; icon: LucideIcon }
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

const ENHANCE_THREAD_OPTIONS_BASE: Omit<EnhanceThreadOptions, "webSearchEnabled"> = {
  modelReasoningEffort: "medium",
};

const DEBUG_ENHANCE_EVENTS_KEY = "promptforge:debug-enhance-events";
const DEBUG_ENHANCE_EVENTS_MAX = 200;
const DEBUG_ENHANCE_PAYLOAD_PREVIEW_CHARS = 1200;
const ENHANCED_PROMPT_SOURCES_SEPARATOR = /\n---\n\s*Sources:\s*\n/i;
const REASONING_ITEM_TYPES = new Set([
  "reasoning",
  "reasoning_summary",
  "reasoning-summary",
  "reasoning.summary",
  "reasoningsummary",
]);
const REASONING_SEGMENT_PATTERN = /(^|[./_-])reasoning([./_-]|$)/;

type EnhanceStreamEvent = {
  eventType: string | null;
  responseType: string | null;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  itemType: string | null;
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

function normalizeEventToken(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasReasoningSegment(value: string | null | undefined): boolean {
  const normalized = normalizeEventToken(value);
  if (!normalized) return false;
  return REASONING_SEGMENT_PATTERN.test(normalized);
}

function isReasoningItemType(value: string | null | undefined): boolean {
  const normalized = normalizeEventToken(value);
  if (!normalized) return false;
  return REASONING_ITEM_TYPES.has(normalized) || hasReasoningSegment(normalized);
}

function extractTextValue(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (!value || typeof value !== "object") return null;
  const obj = value as { text?: unknown; content?: unknown; output_text?: unknown; delta?: unknown };
  if (typeof obj.text === "string" && obj.text) return obj.text;
  if (typeof obj.content === "string" && obj.content) return obj.content;
  if (typeof obj.output_text === "string" && obj.output_text) return obj.output_text;
  if (typeof obj.delta === "string" && obj.delta) return obj.delta;
  return null;
}

function extractTextFromContent(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (!value) return null;
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => extractTextFromContent(entry))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? parts.join("") : null;
  }
  if (typeof value === "object") {
    const obj = value as {
      content?: unknown;
      text?: unknown;
      summary?: unknown;
      reasoning_summary?: unknown;
      reasoningSummary?: unknown;
      parts?: unknown;
    };
    return (
      extractTextValue(obj) ||
      extractTextFromContent(obj.content) ||
      extractTextFromContent(obj.summary) ||
      extractTextFromContent(obj.reasoning_summary) ||
      extractTextFromContent(obj.reasoningSummary) ||
      extractTextFromContent(obj.parts)
    );
  }
  return null;
}

function isReasoningSummaryEvent(meta: EnhanceStreamEvent, payload: unknown): boolean {
  if (isReasoningItemType(meta.itemType)) return true;

  if (hasReasoningSegment(meta.eventType)) return true;

  if (hasReasoningSegment(meta.responseType)) return true;

  if (payload && typeof payload === "object") {
    const payloadItemType = (payload as { item?: { type?: unknown } }).item?.type;
    if (isReasoningItemType(typeof payloadItemType === "string" ? payloadItemType : null)) return true;
  }

  return false;
}

function extractReasoningSummaryChunk(
  meta: EnhanceStreamEvent,
  payload: unknown,
): { text: string; isDelta: boolean; itemId: string | null } | null {
  if (!isReasoningSummaryEvent(meta, payload)) return null;
  if (!payload || typeof payload !== "object") return null;

  const data = payload as {
    delta?: unknown;
    text?: unknown;
    output_text?: unknown;
    content?: unknown;
    summary?: unknown;
    reasoning_summary?: unknown;
    reasoningSummary?: unknown;
    payload?: unknown;
    item?: unknown;
  };
  const item = (data.item ?? {}) as {
    delta?: unknown;
    text?: unknown;
    output_text?: unknown;
    content?: unknown;
    summary?: unknown;
    reasoning_summary?: unknown;
    reasoningSummary?: unknown;
  };

  const deltaText =
    extractTextValue(data.delta) ||
    extractTextFromContent(data.delta) ||
    extractTextValue(item.delta) ||
    extractTextFromContent(item.delta) ||
    extractTextValue((data.payload as { delta?: unknown } | undefined)?.delta);
  if (deltaText) return { text: deltaText, isDelta: true, itemId: meta.itemId };

  const directText =
    extractTextValue(data.reasoning_summary) ||
    extractTextFromContent(data.reasoning_summary) ||
    extractTextValue(data.reasoningSummary) ||
    extractTextFromContent(data.reasoningSummary) ||
    extractTextValue(data.summary) ||
    extractTextFromContent(data.summary) ||
    extractTextValue(item.reasoning_summary) ||
    extractTextFromContent(item.reasoning_summary) ||
    extractTextValue(item.reasoningSummary) ||
    extractTextFromContent(item.reasoningSummary) ||
    extractTextValue(item.summary) ||
    extractTextFromContent(item.summary) ||
    extractTextValue(data.text) ||
    extractTextFromContent(data.text) ||
    extractTextValue(data.output_text) ||
    extractTextFromContent(data.output_text) ||
    extractTextValue(data.content) ||
    extractTextFromContent(data.content) ||
    extractTextValue(item.text) ||
    extractTextFromContent(item.text) ||
    extractTextValue(item.output_text) ||
    extractTextFromContent(item.output_text) ||
    extractTextValue(item.content) ||
    extractTextFromContent(item.content) ||
    extractTextValue((data.payload as { text?: unknown; output_text?: unknown } | undefined)?.text) ||
    extractTextFromContent((data.payload as { text?: unknown; output_text?: unknown } | undefined)?.text) ||
    extractTextValue((data.payload as { output_text?: unknown } | undefined)?.output_text) ||
    extractTextFromContent((data.payload as { output_text?: unknown } | undefined)?.output_text) ||
    extractTextFromContent(item.content);

  if (!directText) return null;

  const eventToken = `${meta.eventType ?? ""} ${meta.responseType ?? ""}`.toLowerCase();
  const isDelta = eventToken.includes("delta");
  return { text: directText, isDelta, itemId: meta.itemId };
}

function splitEnhancedPromptAndSources(input: string): { promptText: string; sources: string[] } {
  const separatorIdx = input.search(ENHANCED_PROMPT_SOURCES_SEPARATOR);
  if (separatorIdx === -1) {
    return {
      promptText: input,
      sources: [],
    };
  }

  const promptText = input.slice(0, separatorIdx).trimEnd();
  const sourcesBlock = input.slice(separatorIdx);
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

function extractEnhancedPromptFromMetadataEvent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    event?: unknown;
    type?: unknown;
    payload?: unknown;
  };
  const eventType = normalizeEventToken(typeof data.event === "string" ? data.event : null);
  const responseType = normalizeEventToken(typeof data.type === "string" ? data.type : null);
  if (eventType !== "enhance/metadata" && responseType !== "enhance.metadata") return null;

  const metadata = data.payload;
  if (!metadata || typeof metadata !== "object") return null;

  const enhancedPrompt = (metadata as { enhanced_prompt?: unknown }).enhanced_prompt;
  if (typeof enhancedPrompt !== "string") return null;
  const normalized = enhancedPrompt.trim();
  return normalized || null;
}

function previewEnhancePayload(payload: unknown): string {
  if (payload === null || payload === undefined) return "";
  try {
    const serialized = JSON.stringify(payload);
    if (!serialized) return "";
    if (serialized.length <= DEBUG_ENHANCE_PAYLOAD_PREVIEW_CHARS) return serialized;
    return `${serialized.slice(0, DEBUG_ENHANCE_PAYLOAD_PREVIEW_CHARS)}...`;
  } catch {
    return "[unserializable payload]";
  }
}

function toEnhanceDebugEventSnapshot(event: EnhanceStreamEvent): EnhanceDebugEventSnapshot {
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
    inferredUpdates.constraints = inferredUpdatesRaw.constraints.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  const inferredFields = Array.isArray(inferredFieldsRaw)
    ? inferredFieldsRaw.filter(
      (field): field is "role" | "tone" | "lengthPreference" | "format" | "constraints" =>
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
    if (typeof inferredUpdates.lengthPreference === "string") inferredFields.push("lengthPreference");
    if (Array.isArray(inferredUpdates.format)) inferredFields.push("format");
    if (Array.isArray(inferredUpdates.constraints)) inferredFields.push("constraints");
  }

  const suggestionChips = Array.isArray(suggestionChipsRaw)
    ? suggestionChipsRaw
      .map((chip): BuilderSuggestionChip | null => {
        if (!chip || typeof chip !== "object") return null;
        const id = typeof chip.id === "string" ? chip.id : null;
        const label = typeof chip.label === "string" ? chip.label : null;
        const description = typeof chip.description === "string" ? chip.description : "";
        const action = chip.action;
        if (!id || !label || !action || typeof action !== "object") return null;

        const actionType = action.type;
        if (actionType === "append_prompt" && typeof action.text === "string") {
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

        if (actionType === "set_fields" && action.updates && typeof action.updates === "object") {
          const updates = action.updates as Record<string, unknown>;
          const fields = Array.isArray(action.fields)
            ? action.fields.filter(
              (field): field is "role" | "tone" | "lengthPreference" | "format" | "constraints" =>
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
                  normalizedUpdates.lengthPreference = updates.lengthPreference;
                }
                if (Array.isArray(updates.format)) {
                  normalizedUpdates.format = updates.format.filter(
                    (entry): entry is string => typeof entry === "string",
                  );
                  normalizedUpdates.customFormat = "";
                }
                if (Array.isArray(updates.constraints)) {
                  normalizedUpdates.constraints = updates.constraints.filter(
                    (entry): entry is string => typeof entry === "string",
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
  if (config.lengthPreference && config.lengthPreference !== defaultConfig.lengthPreference) {
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
  const [openSections, setOpenSections] = useState<BuilderSection[]>(["builder"]);
  const [isAdjustDetailsOpen, setIsAdjustDetailsOpen] = useState(false);
  const [isSourcesAdvancedOpen, setIsSourcesAdvancedOpen] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(() => getUserPreferences().showAdvancedControls);
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
  const [suggestionChips, setSuggestionChips] = useState<BuilderSuggestionChip[]>([]);
  const [isInferringSuggestions, setIsInferringSuggestions] = useState(false);
  const [hasInferenceError, setHasInferenceError] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => getUserPreferences().webSearchEnabled);
  const [webSearchSources, setWebSearchSources] = useState<string[]>([]);
  const [reasoningSummary, setReasoningSummary] = useState("");
  const [fieldOwnership, setFieldOwnership] = useState<BuilderFieldOwnershipMap>(() =>
    createFieldOwnershipFromConfig(defaultConfig),
  );
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const persistedSetWebSearchEnabled = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setWebSearchEnabled((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      setUserPreference("webSearchEnabled", next);
      return next;
    });
  }, []);

  const persistedSetShowAdvancedControls = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setShowAdvancedControls((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      setUserPreference("showAdvancedControls", next);
      return next;
    });
  }, []);

  const {
    config,
    updateConfig,
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
  const heroCopy = useMemo(() => getHeroCopyVariant(heroCopyVariant), [heroCopyVariant]);
  const primaryCtaLabel = useMemo(
    () => getPrimaryCtaVariantLabel(primaryCtaVariant),
    [primaryCtaVariant],
  );

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
      primaryCtaExperimentEnabled: launchExperimentFlags.launchPrimaryCtaExperiment,
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
    setEnhancedPrompt(restoredPrompt);
    setReasoningSummary("");
    toast({ title: "Version restored", description: "Restored from History." });
    if (isMobile) {
      setDrawerOpen(true);
    }
  }, [isMobile, setEnhancedPrompt, toast]);

  useEffect(() => {
    if (!presetId) return;
    const preset = templates.find((t) => t.id === presetId);
    if (!preset) {
      toast({ title: "Preset not found", description: `No preset with id "${presetId}".` });
      setSearchParams((prev) => { prev.delete("preset"); return prev; }, { replace: true });
      return;
    }
    loadTemplate(preset);
    toast({ title: "Preset loaded", description: `"${preset.name}" applied to the builder.` });
    setSearchParams((prev) => { prev.delete("preset"); return prev; }, { replace: true });
  }, [presetId, loadTemplate, toast, setSearchParams]);

  useEffect(() => {
    if (!remixId) return;
    if (remixContext?.postId === remixId) return;
    const token = ++remixLoadToken.current;

    void (async () => {
      try {
        const post = await loadPost(remixId);
        if (token !== remixLoadToken.current) return;
        if (!post) {
          toast({ title: "Remix unavailable", description: "That community prompt could not be loaded." });
          return;
        }
        const [author] = await loadProfilesByIds([post.authorId]);
        if (token !== remixLoadToken.current) return;

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
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    })();
  }, [remixId, remixContext?.postId, startRemix, toast]);

  const handleClearRemix = useCallback(() => {
    clearRemix();
    if (!remixId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("remix");
    setSearchParams(next, { replace: true });
  }, [clearRemix, remixId, searchParams, setSearchParams]);

  const clearEnhanceTimers = useCallback(() => {
    enhancePhaseTimers.current.forEach((timer) => window.clearTimeout(timer));
    enhancePhaseTimers.current = [];
  }, []);

  useEffect(() => {
    return () => clearEnhanceTimers();
  }, [clearEnhanceTimers]);

  const handleAdjustDetailsUpdate = useCallback(
    (updates: Partial<typeof config>) => {
      if (isBuilderRedesignPhase3) {
        const fields = listInferenceFieldsFromUpdates(updates);
        if (fields.length > 0) {
          setFieldOwnership((previous) => markOwnershipFields(previous, fields, "user"));
          trackBuilderEvent("builder_field_manual_override", {
            fields: fields.join(","),
          });
        }
      }

      updateConfig(updates);
    },
    [isBuilderRedesignPhase3, updateConfig],
  );

  const handleApplySuggestionChip = useCallback(
    (chip: BuilderSuggestionChip) => {
      if (chip.action.type === "append_prompt") {
        updateConfig({
          originalPrompt: `${config.originalPrompt}${chip.action.text}`,
        });
        return;
      }

      const fields = chip.action.fields.length > 0
        ? chip.action.fields
        : listInferenceFieldsFromUpdates(chip.action.updates);
      updateConfig(chip.action.updates);
      setFieldOwnership((previous) => markOwnershipFields(previous, fields, "ai"));
      setIsAdjustDetailsOpen(true);
      trackBuilderEvent("builder_inference_applied", {
        source: "chip",
        fields: fields.join(","),
      });
    },
    [config.originalPrompt, updateConfig],
  );

  const handleResetInferredDetails = useCallback(() => {
    const { updates, clearedFields, nextOwnership } = clearAiOwnedFields(fieldOwnership);
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
      let configForEnhance = config;
      let promptForEnhance = buildPrompt(configForEnhance);
      if (!promptForEnhance) {
        enhancePending.current = false;
        return;
      }

      if (isBuilderRedesignPhase3) {
        clearEnhanceTimers();
        setEnhancePhase("starting");
        setIsEnhancing(true);
        enhancePending.current = false;
        const applyInferenceResult = (
          inference: ReturnType<typeof inferBuilderFieldsLocally>,
          source: "enhance_remote" | "enhance_local",
        ) => {
          if (inference.suggestionChips.length > 0) {
            setSuggestionChips(inference.suggestionChips);
          }

          const { updates, appliedFields } = applyInferenceUpdates(configForEnhance, fieldOwnership, inference);
          if (appliedFields.length === 0) return;

          updateConfig(updates);
          setFieldOwnership((previous) => markOwnershipFields(previous, appliedFields, "ai"));
          setIsAdjustDetailsOpen(true);
          configForEnhance = { ...configForEnhance, ...updates };
          promptForEnhance = buildPrompt(configForEnhance);
          trackBuilderEvent("builder_inference_applied", {
            source,
            fields: appliedFields.join(","),
          });
        };

        try {
          const remote = await inferBuilderFields({
            prompt: config.originalPrompt,
            currentFields: buildInferenceCurrentFields(configForEnhance),
            lockMetadata: fieldOwnership,
          });

          const normalized = normalizeRemoteInferenceResult(remote);
          if (normalized.inferredFields.length > 0 || normalized.suggestionChips.length > 0) {
            applyInferenceResult(normalized, "enhance_remote");
          } else {
            applyInferenceResult(inferBuilderFieldsLocally(config.originalPrompt, config), "enhance_local");
          }
          setHasInferenceError(false);
        } catch {
          setHasInferenceError(true);
          applyInferenceResult(inferBuilderFieldsLocally(config.originalPrompt, config), "enhance_local");
        }
      }

      if (!promptForEnhance) {
        if (isBuilderRedesignPhase3) {
          setIsEnhancing(false);
          setEnhancePhase("idle");
        }
        enhancePending.current = false;
        return;
      }

      enhanceStartedAt.current = Date.now();
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
      setWebSearchSources([]);

      if (isMobile) setDrawerOpen(true);

      enhanceStreamToken.current += 1;
      enhanceAbortController.current?.abort();
      const streamToken = enhanceStreamToken.current;
      const streamAbortController = new AbortController();
      enhanceAbortController.current = streamAbortController;

      let accumulated = "";
      let hasReceivedDelta = false;
      const reasoningByItemId = new Map<string, string>();
      const reasoningItemOrder: string[] = [];
      const REASONING_FALLBACK_ITEM_ID = "__reasoning_summary__";
      const debugEnhanceEvents = isEnhanceDebugEnabled();
      const debugEventStore =
        debugEnhanceEvents && typeof window !== "undefined"
          ? ((window as typeof window & { __promptforgeEnhanceEvents?: EnhanceDebugEventSnapshot[] })
            .__promptforgeEnhanceEvents ??= [])
          : null;
      const outputFormats = [
        ...configForEnhance.format,
        configForEnhance.customFormat.trim(),
      ].filter((value) => value.length > 0);
      const outputFormatField = [
        outputFormats.join(", "),
        configForEnhance.lengthPreference ? `Length: ${configForEnhance.lengthPreference}` : "",
      ]
        .filter((value) => value.length > 0)
        .join(" | ");
      const guardrailItems = [
        ...configForEnhance.constraints,
        configForEnhance.customConstraint.trim(),
        configForEnhance.tone ? `Tone: ${configForEnhance.tone}` : "",
        configForEnhance.complexity ? `Complexity: ${configForEnhance.complexity}` : "",
      ].filter((value) => value.length > 0);
      const applyEnhancedOutput = (nextOutput: string, clearSourcesWhenMissing = false) => {
        const { promptText, sources } = splitEnhancedPromptAndSources(nextOutput);
        if (sources.length > 0) {
          setEnhancedPrompt(promptText);
          setWebSearchSources(sources);
          return;
        }

        setEnhancedPrompt(nextOutput);
        if (clearSourcesWhenMissing) {
          setWebSearchSources([]);
        }
      };
      streamEnhance({
        prompt: promptForEnhance,
        threadOptions: { ...ENHANCE_THREAD_OPTIONS_BASE, webSearchEnabled },
        builderFields: {
          role: (configForEnhance.customRole || configForEnhance.role || "").trim(),
          context: configForEnhance.context.trim(),
          task: (configForEnhance.originalPrompt || configForEnhance.task || "").trim(),
          outputFormat: outputFormatField,
          examples: configForEnhance.examples.trim(),
          guardrails: guardrailItems.join("; "),
        },
        signal: streamAbortController.signal,
        onDelta: (text) => {
          if (streamToken !== enhanceStreamToken.current) return;
          if (!hasReceivedDelta) {
            hasReceivedDelta = true;
            setEnhancePhase("streaming");
          }
          accumulated += text;
          applyEnhancedOutput(accumulated);
        },
        onEvent: (event) => {
          if (streamToken !== enhanceStreamToken.current) return;
          if (debugEventStore) {
            debugEventStore.push(toEnhanceDebugEventSnapshot(event));
            if (debugEventStore.length > DEBUG_ENHANCE_EVENTS_MAX) {
              debugEventStore.splice(0, debugEventStore.length - DEBUG_ENHANCE_EVENTS_MAX);
            }
          }

          const metadataPrompt = extractEnhancedPromptFromMetadataEvent(event.payload);
          if (metadataPrompt) {
            accumulated = metadataPrompt;
            applyEnhancedOutput(metadataPrompt, true);
            return;
          }

          const chunk = extractReasoningSummaryChunk(event, event.payload);
          if (!chunk?.text) return;

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
        onDone: () => {
          if (streamToken !== enhanceStreamToken.current) return;
          if (enhanceAbortController.current === streamAbortController) {
            enhanceAbortController.current = null;
          }
          const startedAt = enhanceStartedAt.current;
          const durationMs = startedAt ? Math.max(Date.now() - startedAt, 0) : -1;
          enhanceStartedAt.current = null;
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
            description: "Prompt updated with clearer structure, context, and constraints.",
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
          const durationMs = startedAt ? Math.max(Date.now() - startedAt, 0) : -1;
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
          toast({ title: "Enhancement failed", description: errorMessage, variant: "destructive" });
        },
      });
    })();
  }, [
    clearEnhanceTimers,
    config,
    enhancedPrompt,
    fieldOwnership,
    isBuilderRedesignPhase1,
    isBuilderRedesignPhase3,
    isEnhancing,
    isMobile,
    setEnhancedPrompt,
    setIsEnhancing,
    setReasoningSummary,
    toast,
    updateConfig,
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
    async (input: { name: string; description?: string; tags?: string[]; category?: string; remixNote?: string }) => {
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
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [savePrompt, toast, remixContext, handleClearRemix]
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
      if (!isSignedIn) {
        toast({ title: "Sign in required", description: "Sign in to share prompts.", variant: "destructive" });
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
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [isSignedIn, saveAndSharePrompt, toast, remixContext, handleClearRemix]
  );

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
  const hasEnhancedOnce = enhancedPrompt.trim().length > 0;
  const allSectionsComplete =
    sectionHealth.builder === "complete" &&
    sectionHealth.context === "complete" &&
    sectionHealth.tone === "complete";
  const showEnhanceFirstCard = !hasEnhancedOnce && (isBuilderRedesignPhase1 || !allSectionsComplete);
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
  const shouldShowAdvancedControls =
    showAdvancedControls || hasEnhancedOnce || hasDetailSelections || hasSourceOrAdvancedSelections;
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
      return "Your prompt preview updates as you build. Tap to expand.";
    }
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("\n");
  }, [displayPrompt]);
  const refineSuggestions = useMemo(() => {
    const suggestions: Array<{ id: BuilderSection; title: string; description: string }> = [];
    if (sectionHealth.builder !== "complete") {
      suggestions.push({
        id: "builder",
        title: selectedRole ? "Add task details" : "Add a role",
        description: "Clarify who the model should be and what outcome you need.",
      });
    }
    if (sectionHealth.context !== "complete") {
      suggestions.push({
        id: "context",
        title: "Add context",
        description: "Include sources, notes, or constraints from your environment.",
      });
    }
    if (sectionHealth.tone !== "complete") {
      suggestions.push({
        id: "tone",
        title: "Tune tone",
        description: "Set style and complexity to better match the target audience.",
      });
    }
    return suggestions.slice(0, 3);
  }, [sectionHealth.builder, sectionHealth.context, sectionHealth.tone, selectedRole]);
  const showRefineSuggestions = Boolean(enhancedPrompt.trim()) && refineSuggestions.length > 0;
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
      (Object.keys(next) as Array<keyof BuilderFieldOwnershipMap>).forEach((field) => {
        if (baseline[field] === "user" && previous[field] === "empty") {
          next[field] = "user";
          changed = true;
        }
        if (baseline[field] === "empty" && previous[field] === "user") {
          next[field] = "empty";
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [isBuilderRedesignPhase3, config]);

  useEffect(() => {
    if (!isBuilderRedesignPhase1) return;

    if (hasEnhancedOnce || hasDetailSelections || hasSourceOrAdvancedSelections) {
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
          if (normalized.suggestionChips.length > 0) {
            setSuggestionChips(normalized.suggestionChips);
          } else {
            setSuggestionChips(inferBuilderFieldsLocally(prompt, config).suggestionChips);
          }
          setHasInferenceError(false);
        } catch {
          if (token !== suggestionLoadToken.current) return;
          setSuggestionChips(inferBuilderFieldsLocally(prompt, config).suggestionChips);
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
  }, [
    isBuilderRedesignPhase3,
    config,
    fieldOwnership,
  ]);

  const openAndFocusSection = useCallback((section: BuilderSection) => {
    if (isBuilderRedesignPhase1) {
      const targetId = section === "context" ? "builder-zone-3" : "builder-zone-2";
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
    setOpenSections((prev) => (prev.includes(section) ? prev : [...prev, section]));
    window.requestAnimationFrame(() => {
      document.getElementById(`accordion-${section}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [isBuilderRedesignPhase1, persistedSetShowAdvancedControls]);

  return (
    <PageShell mainClassName="py-3 sm:py-6">
      {isMobile && (
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {enhanceLiveMessage}
        </p>
      )}
      {/* Hero — compact on mobile */}
      <div
        className="pf-gilded-frame pf-hero-surface mb-4 px-4 py-5 text-center sm:mb-8 sm:px-6 sm:py-7"
        data-testid="builder-hero"
      >
        <h1 className="pf-text-display mb-1 text-xl font-bold tracking-tight text-[rgba(230,225,213,.95)] sm:mb-2 sm:text-3xl md:text-4xl">
          {heroCopy.headline}
        </h1>
        <p className="mx-auto max-w-2xl text-xs text-[rgba(230,225,213,.82)] sm:text-sm md:text-base">
          {heroCopy.subhead}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {brandCopy.pillars.map((pillar) => (
            <Badge
              key={pillar.title}
              type="modern"
              className="border border-[rgba(214,166,64,.35)] bg-black/35 text-2xs text-[rgba(230,225,213,.9)] sm:text-xs"
            >
              {pillar.title}
            </Badge>
          ))}
        </div>
        <div className="mx-auto mt-3 w-44 pf-divider" />
      </div>

      {remixContext && (
        <Card className="mb-4 border-primary/30 bg-primary/5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="type-label-caps text-xs text-primary">Remix mode</p>
              <p className="text-sm font-medium text-foreground">
                Remixing {remixContext.parentAuthor}’s “{remixContext.parentTitle}”
              </p>
              <p className="text-xs text-muted-foreground">
                Your changes will be attributed when you save or share.
              </p>
            </div>
            <Button
              color="tertiary"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: Input & Builder */}
        <div className="space-y-3 sm:space-y-4">
          {isBuilderRedesignPhase1 ? (
            <>
              <BuilderHeroInput
                value={config.originalPrompt}
                onChange={(value) => updateConfig({ originalPrompt: value })}
                onClear={clearOriginalPrompt}
                phase3Enabled={isBuilderRedesignPhase3}
                suggestionChips={suggestionChips}
                isInferringSuggestions={isInferringSuggestions}
                hasInferenceError={hasInferenceError}
                onApplySuggestion={handleApplySuggestionChip}
                onResetInferred={handleResetInferredDetails}
                canResetInferred={hasAiOwnedFields}
              />

              {showEnhanceFirstCard && (
                <Card className="border-border/70 bg-card/80 p-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Start in 3 steps</p>
                    <ol className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                      <li>1. Add your rough prompt</li>
                      <li>2. Tap {primaryCtaLabel}</li>
                      <li>3. Refine details</li>
                    </ol>
                    <p className="text-xs text-muted-foreground">
                      Keep the first pass simple, then strengthen quality, context, and remix readiness.
                    </p>
                  </div>
                </Card>
              )}

              {showRefineSuggestions && (
                <Card className="border-primary/25 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary">Improve this result</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {refineSuggestions.map((suggestion) => (
                      <Button
                        key={suggestion.id}
                        type="button"
                        size="sm"
                        color="secondary"
                        className="h-11 text-sm sm:h-9 sm:text-base"
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
                      <p className="text-sm font-medium text-foreground">Need more control?</p>
                      <p className="text-xs text-muted-foreground">
                        Reveal advanced settings when you are ready to refine.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      color="secondary"
                      className="h-11 text-sm sm:h-9 sm:text-base"
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
            </>
          ) : (
            <>
              <PromptInput
                value={config.originalPrompt}
                onChange={(v) => updateConfig({ originalPrompt: v })}
                onClear={clearOriginalPrompt}
              />

              {showEnhanceFirstCard && (
                <Card className="border-border/70 bg-card/80 p-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Start in 3 steps</p>
                    <ol className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                      <li>1. Add your rough prompt</li>
                      <li>2. Tap {primaryCtaLabel}</li>
                      <li>3. Refine details</li>
                    </ol>
                    <p className="text-xs text-muted-foreground">
                      Keep the first pass simple, then strengthen quality, context, and remix readiness.
                    </p>
                  </div>
                </Card>
              )}

              {showRefineSuggestions && (
                <Card className="border-primary/25 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary">Improve this result</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {refineSuggestions.map((suggestion) => (
                      <Button
                        key={suggestion.id}
                        type="button"
                        size="sm"
                        color="secondary"
                        className="h-11 text-sm sm:h-9 sm:text-base"
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
                onValueChange={(value) => setOpenSections(value as BuilderSection[])}
                className="space-y-1"
              >
                <AccordionItem id="accordion-builder" value="builder" className="border rounded-lg px-3">
                  <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                    <span className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-muted-foreground" />
                      Builder
                    </span>
                    <span className="ml-auto mr-2 flex items-center gap-1.5">
                      {selectedRole && (
                        <Badge type="modern" className="max-w-45 text-xs">
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

                <AccordionItem id="accordion-context" value="context" className="border rounded-lg px-3">
                  <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                    <span className="flex items-center gap-2">
                      <LayoutIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      Context & Sources
                    </span>
                    <span className="ml-auto mr-2 flex items-center gap-1.5">
                      {sourceCount > 0 && (
                        <Badge type="modern" className="text-xs">
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
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem id="accordion-tone" value="tone" className="border rounded-lg px-3">
                  <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                      Tone & Style
                    </span>
                    <span className="ml-auto mr-2 flex items-center gap-1.5">
                      {config.tone && (
                        <Badge type="modern" className="text-xs">
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

                <AccordionItem id="accordion-quality" value="quality" className="border rounded-lg px-3">
                  <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                      Quality Score
                    </span>
                    <span className="ml-auto mr-2 flex items-center gap-1.5">
                      <Badge
                        type="pill-color"
                        color={score.total >= 75 ? "brand" : "gray"}
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
          <div className="lg:sticky lg:top-20 lg:self-start">
            {isBuilderRedesignPhase1 && (
              <Card className="pf-panel mb-3 border-[rgba(214,166,64,.32)] bg-card/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[rgba(230,225,213,.92)]">Quality signal</p>
                    <p className="mt-0.5 text-xs text-[rgba(230,225,213,.72)]">
                      {score.tips[0]}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge type="pill-color" color={score.total >= 75 ? "brand" : "gray"} className="text-xs">
                      {score.total}/100
                    </Badge>
                    <span className="text-[11px] text-[rgba(230,225,213,.72)]">
                      {score.total >= 90 ? "Legendary" : score.total >= 70 ? "Epic" : score.total >= 40 ? "Rare" : "Common"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-2">
                  <PFQualityGauge value={score.total} size={92} showLabel={false} />
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
              phase2Enabled={isBuilderRedesignPhase2}
              webSearchEnabled={webSearchEnabled}
              onWebSearchToggle={persistedSetWebSearchEnabled}
              webSearchSources={webSearchSources}
              enhanceIdleLabel={primaryCtaLabel}
              remixContext={
                remixContext
                  ? { title: remixContext.parentTitle, authorName: remixContext.parentAuthor }
                  : undefined
              }
            />
            <p className="text-xs text-muted-foreground text-center mt-3">
              Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono">Ctrl+Enter</kbd> to enhance
            </p>
          </div>
        )}
      </div>

      {/* Mobile: sticky bottom bar */}
      {isMobile && (
        <div
          className="fixed inset-x-0 bottom-[calc(4.375rem+env(safe-area-inset-bottom)+1px)] sm:bottom-0 z-30 border-t border-border bg-card/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
          data-testid="builder-mobile-sticky-bar"
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="interactive-chip mb-2 w-full rounded-lg border border-border/80 bg-background/70 px-3 py-2 text-left"
            aria-label="Open output preview"
            data-testid="builder-mobile-preview-trigger"
          >
            <div className="type-label-caps flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              Live preview
            </div>
            <p className="mt-1 max-h-10 overflow-hidden whitespace-pre-line font-mono text-xs leading-5 text-foreground/90">
              {mobilePreviewText}
            </p>
          </button>

          <div className="flex items-center gap-2 max-[360px]:grid max-[360px]:grid-cols-2">
            <label
              className="flex min-h-11 min-w-23 items-center justify-center gap-2 rounded-md border border-border/70 bg-background/70 px-2 text-sm text-muted-foreground cursor-pointer select-none max-[360px]:min-w-0"
              data-testid="builder-mobile-web-toggle"
            >
              <Switch
                checked={webSearchEnabled}
                onCheckedChange={persistedSetWebSearchEnabled}
                disabled={isEnhancing}
                aria-label="Enable web search during enhancement"
              />
              <Globe className="h-3.5 w-3.5" />
              <span>Web</span>
            </label>
            <Badge
              type="pill-color"
              color={score.total >= 75 ? "brand" : "gray"}
              className="h-11 min-w-16 justify-center rounded-md px-2 text-sm font-semibold max-[360px]:min-w-0 max-[360px]:justify-self-end sm:h-10 sm:text-base"
            >
              {score.total}/100
            </Badge>
            <Button
              color="primary"
              size="md"
              onClick={handleEnhance}
              disabled={isEnhancing || !builtPrompt}
              className="signature-enhance-button h-11 min-w-0 flex-1 gap-2 max-[360px]:col-span-2 max-[360px]:w-full max-[360px]:gap-1 max-[360px]:px-2 max-[360px]:text-xs sm:h-10"
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
                  {enhancePhase === "done" ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  {mobileEnhanceLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile: output drawer */}
      {isMobile && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>
                {enhancedPrompt ? "✨ Enhanced Prompt" : "📝 Preview"}
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
                phase2Enabled={isBuilderRedesignPhase2}
                enhanceIdleLabel={primaryCtaLabel}
                hideEnhanceButton
                remixContext={
                  remixContext
                    ? { title: remixContext.parentTitle, authorName: remixContext.parentAuthor }
                    : undefined
                }
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Add bottom padding on mobile for sticky bar */}
      {isMobile && <div className="h-44 sm:h-32" />}
    </PageShell>
  );
};

export default Index;
