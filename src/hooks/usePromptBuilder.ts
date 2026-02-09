import { useState, useCallback, useEffect, useRef } from "react";
import { PromptConfig, defaultConfig, buildPrompt, scorePrompt } from "@/lib/prompt-builder";
import type {
  ContextSource,
  StructuredContext,
  InterviewAnswer,
  DatabaseConnection,
  RagParameters,
} from "@/lib/context-types";
import { defaultContextConfig } from "@/lib/context-types";
import {
  listTemplateSummaries as listLocalTemplateSummaries,
  type SaveTemplateResult,
  type TemplateLoadResult,
  type TemplateSummary,
} from "@/lib/template-store";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import * as persistence from "@/lib/persistence";

const STORAGE_KEY = "promptforge-draft";
const LOCAL_VERSIONS_KEY = "promptforge-local-versions";
const DRAFT_AUTOSAVE_DELAY_MS = 700;
const MAX_LOCAL_VERSIONS = 50;

function hydrateConfig(raw: unknown): PromptConfig {
  if (!raw || typeof raw !== "object") return defaultConfig;
  const candidate = raw as Partial<PromptConfig>;
  return {
    ...defaultConfig,
    ...candidate,
    format: Array.isArray(candidate.format) ? candidate.format : [],
    constraints: Array.isArray(candidate.constraints) ? candidate.constraints : [],
    contextConfig: {
      ...defaultContextConfig,
      ...(candidate.contextConfig || {}),
      sources: Array.isArray(candidate.contextConfig?.sources) ? candidate.contextConfig.sources : [],
      databaseConnections: Array.isArray(candidate.contextConfig?.databaseConnections)
        ? candidate.contextConfig.databaseConnections
        : [],
      rag: {
        ...defaultContextConfig.rag,
        ...(candidate.contextConfig?.rag || {}),
        documentRefs: Array.isArray(candidate.contextConfig?.rag?.documentRefs)
          ? candidate.contextConfig.rag.documentRefs
          : [],
      },
      structured: {
        ...defaultContextConfig.structured,
        ...(candidate.contextConfig?.structured || {}),
      },
      interviewAnswers: Array.isArray(candidate.contextConfig?.interviewAnswers)
        ? candidate.contextConfig.interviewAnswers
        : [],
    },
  };
}

function loadLocalDraft(): PromptConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? hydrateConfig(JSON.parse(saved)) : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

function isPromptVersion(value: unknown): value is persistence.PromptVersion {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.timestamp === "number"
  );
}

function loadLocalVersions(): persistence.PromptVersion[] {
  try {
    const saved = localStorage.getItem(LOCAL_VERSIONS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPromptVersion).sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_LOCAL_VERSIONS);
  } catch {
    return [];
  }
}

function saveLocalVersions(versions: persistence.PromptVersion[]): void {
  try {
    localStorage.setItem(LOCAL_VERSIONS_KEY, JSON.stringify(versions.slice(0, MAX_LOCAL_VERSIONS)));
  } catch {
    // quota errors are intentionally ignored to keep the UI responsive
  }
}

function clearLocalVersions(): void {
  try {
    localStorage.removeItem(LOCAL_VERSIONS_KEY);
  } catch {
    // ignore
  }
}

export function usePromptBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? null;
  const [config, setConfig] = useState<PromptConfig>(loadLocalDraft);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [versions, setVersions] = useState<persistence.PromptVersion[]>(loadLocalVersions);
  const [templateSummaries, setTemplateSummaries] = useState<TemplateSummary[]>(() =>
    listLocalTemplateSummaries(),
  );
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isCloudHydrated, setIsCloudHydrated] = useState(false);

  const prevUserId = useRef<string | null>(null);
  const draftSaveError = useRef<string | null>(null);
  const authLoadToken = useRef(0);
  const autosaveToken = useRef(0);
  const editsSinceAuthChange = useRef(false);

  const showPersistenceError = useCallback(
    (title: string, error: unknown, fallback: string) => {
      toast({
        title,
        description: persistence.getPersistenceErrorMessage(error, fallback),
        variant: "destructive",
      });
    },
    [toast],
  );

  const markDraftDirty = useCallback(() => {
    editsSinceAuthChange.current = true;
    setIsDraftDirty(true);
  }, []);

  useEffect(() => {
    if (userId) return;
    saveLocalVersions(versions);
  }, [userId, versions]);

  // Load draft/templates/versions when the auth identity changes.
  useEffect(() => {
    const previousUserId = prevUserId.current;
    if (userId === previousUserId) return;
    prevUserId.current = userId;
    draftSaveError.current = null;
    editsSinceAuthChange.current = false;
    setIsDraftDirty(false);
    setEnhancedPrompt("");
    setConfig(defaultConfig);
    setTemplateSummaries([]);
    setVersions([]);

    const token = ++authLoadToken.current;

    if (!userId) {
      setIsCloudHydrated(true);
      setConfig(loadLocalDraft());
      setTemplateSummaries(listLocalTemplateSummaries());
      setVersions(loadLocalVersions());
      return;
    }

    const migrateVersionsFromGuestToCloud = !previousUserId
      ? async () => {
          const localVersions = loadLocalVersions();
          if (localVersions.length === 0) return;

          const migration = await Promise.allSettled(
            localVersions.map((version) => persistence.saveVersion(userId, version.name, version.prompt)),
          );
          const failedVersions = localVersions.filter((_, index) => migration[index]?.status === "rejected");
          const failedCount = failedVersions.length;
          if (failedCount > 0) {
            saveLocalVersions(failedVersions);
            toast({
              title: "Some local versions were not migrated",
              description:
                failedCount === 1
                  ? "1 local version could not be copied to cloud history."
                  : `${failedCount} local versions could not be copied to cloud history.`,
              variant: "destructive",
            });
            return;
          }
          clearLocalVersions();
        }
      : async () => {};

    setIsCloudHydrated(false);

    void Promise.allSettled([
      persistence.loadDraft(userId),
      persistence.loadTemplates(userId),
      (async () => {
        await migrateVersionsFromGuestToCloud();
        return persistence.loadVersions(userId);
      })(),
    ]).then(([draftResult, templatesResult, versionsResult]) => {
      if (token !== authLoadToken.current) return;

      if (draftResult.status === "fulfilled") {
        if (draftResult.value && !editsSinceAuthChange.current) {
          setConfig(hydrateConfig(draftResult.value));
        } else if (draftResult.value && editsSinceAuthChange.current) {
          toast({
            title: "Cloud draft was not applied",
            description: "You started editing before cloud draft finished loading, so your current edits were kept.",
          });
        }
      } else {
        showPersistenceError("Failed to load draft", draftResult.reason, "Failed to load draft.");
      }

      if (templatesResult.status === "fulfilled") {
        setTemplateSummaries(templatesResult.value);
      } else {
        setTemplateSummaries([]);
        showPersistenceError("Failed to load presets", templatesResult.reason, "Failed to load presets.");
      }

      if (versionsResult.status === "fulfilled") {
        setVersions(versionsResult.value);
      } else {
        setVersions([]);
        showPersistenceError(
          "Failed to load version history",
          versionsResult.reason,
          "Failed to load version history.",
        );
      }

      setIsCloudHydrated(true);
      if (!editsSinceAuthChange.current) {
        setIsDraftDirty(false);
      }
    });
  }, [userId, showPersistenceError, toast]);

  const refreshTemplateSummaries = useCallback(async () => {
    if (userId) {
      try {
        const summaries = await persistence.loadTemplates(userId);
        setTemplateSummaries(summaries);
      } catch (error) {
        showPersistenceError("Failed to refresh presets", error, "Failed to refresh presets.");
      }
    } else {
      setTemplateSummaries(listLocalTemplateSummaries());
    }
  }, [userId, showPersistenceError]);

  const saveDraftSafely = useCallback(
    async (nextConfig: PromptConfig, saveToken: number) => {
      try {
        await persistence.saveDraft(userId, nextConfig);
        draftSaveError.current = null;
        if (saveToken === autosaveToken.current) {
          setIsDraftDirty(false);
        }
      } catch (error) {
        const message = persistence.getPersistenceErrorMessage(error, "Failed to save draft.");
        if (draftSaveError.current !== message) {
          draftSaveError.current = message;
          toast({
            title: "Draft auto-save failed",
            description: message,
            variant: "destructive",
          });
        }
      }
    },
    [userId, toast],
  );

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!isDraftDirty) return;
    if (userId && !isCloudHydrated) return;

    const saveToken = ++autosaveToken.current;
    const timeout = setTimeout(() => {
      void saveDraftSafely(config, saveToken);
    }, DRAFT_AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [config, isDraftDirty, userId, isCloudHydrated, saveDraftSafely]);

  const updateConfig = useCallback(
    (updates: Partial<PromptConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
    setEnhancedPrompt("");
    if (!userId) {
      persistence.clearLocalDraft();
      setIsDraftDirty(false);
      editsSinceAuthChange.current = false;
      return;
    }
    markDraftDirty();
  }, [userId, markDraftDirty]);

  const clearOriginalPrompt = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      originalPrompt: "",
    }));
    setEnhancedPrompt("");
    markDraftDirty();
  }, [markDraftDirty]);

  // Context-specific updaters
  const updateContextSources = useCallback(
    (sources: ContextSource[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, sources },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateDatabaseConnections = useCallback(
    (databaseConnections: DatabaseConnection[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, databaseConnections },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateRagParameters = useCallback(
    (ragUpdates: Partial<RagParameters>) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: {
          ...prev.contextConfig,
          rag: { ...prev.contextConfig.rag, ...ragUpdates },
        },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateContextStructured = useCallback(
    (updates: Partial<StructuredContext>) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: {
          ...prev.contextConfig,
          structured: { ...prev.contextConfig.structured, ...updates },
        },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateContextInterview = useCallback(
    (answers: InterviewAnswer[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, interviewAnswers: answers },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateProjectNotes = useCallback(
    (notes: string) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, projectNotes: notes },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const toggleDelimiters = useCallback(
    (value: boolean) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, useDelimiters: value },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const builtPrompt = buildPrompt(config);
  const score = scorePrompt(config);

  const saveVersion = useCallback(
    (name?: string) => {
      const promptToSave = enhancedPrompt || builtPrompt;
      if (!promptToSave) return;
      const versionName = name || `Version ${versions.length + 1}`;

      if (userId) {
        void persistence
          .saveVersion(userId, versionName, promptToSave)
          .then((saved) => {
            if (saved) setVersions((prev) => [saved, ...prev]);
          })
          .catch((error) => {
            showPersistenceError("Failed to save version", error, "Failed to save version.");
          });
      } else {
        const version: persistence.PromptVersion = {
          id: Date.now().toString(),
          name: versionName,
          prompt: promptToSave,
          timestamp: Date.now(),
        };
        setVersions((prev) => [version, ...prev].slice(0, MAX_LOCAL_VERSIONS));
      }
    },
    [enhancedPrompt, builtPrompt, versions.length, userId, showPersistenceError],
  );

  const loadTemplate = useCallback(
    (template: {
      role: string;
      task: string;
      context: string;
      format: string[];
      lengthPreference: string;
      tone: string;
      complexity: string;
      constraints: string[];
      examples: string;
    }) => {
      setConfig({
        ...defaultConfig,
        role: template.role,
        task: template.task,
        context: template.context,
        format: template.format,
        lengthPreference: template.lengthPreference,
        tone: template.tone,
        complexity: template.complexity,
        constraints: template.constraints,
        examples: template.examples,
      });
      setEnhancedPrompt("");
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const saveAsTemplate = useCallback(
    async (input: {
      name: string;
      description?: string;
      tags?: string[];
    }): Promise<SaveTemplateResult> => {
      const result = await persistence.saveTemplate(userId, { ...input, config });
      await refreshTemplateSummaries();
      return result;
    },
    [config, userId, refreshTemplateSummaries],
  );

  const loadSavedTemplate = useCallback(
    async (id: string): Promise<TemplateLoadResult | null> => {
      const loaded = await persistence.loadTemplateById(userId, id);
      if (!loaded) return null;
      setConfig(hydrateConfig(loaded.record.state.promptConfig));
      setEnhancedPrompt("");
      markDraftDirty();
      return loaded;
    },
    [userId, markDraftDirty],
  );

  const deleteSavedTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      const deleted = await persistence.deleteTemplate(userId, id);
      if (deleted) await refreshTemplateSummaries();
      return deleted;
    },
    [userId, refreshTemplateSummaries],
  );

  return {
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
    versions,
    saveVersion,
    loadTemplate,
    saveAsTemplate,
    loadSavedTemplate,
    deleteSavedTemplate,
    templateSummaries,
    // Context-specific
    updateContextSources,
    updateDatabaseConnections,
    updateRagParameters,
    updateContextStructured,
    updateContextInterview,
    updateProjectNotes,
    toggleDelimiters,
  };
}
