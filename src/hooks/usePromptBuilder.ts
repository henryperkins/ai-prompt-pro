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
import { computeRemixDiff } from "@/lib/community";

const STORAGE_KEY = "promptforge-draft";
const LOCAL_VERSIONS_KEY = "promptforge-local-versions";
const DRAFT_AUTOSAVE_DELAY_MS = 700;
const MAX_LOCAL_VERSIONS = 50;

interface RemixContext {
  postId: string;
  parentTitle: string;
  parentAuthor: string;
  parentConfig: PromptConfig;
  parentTags: string[];
  parentCategory: string;
}

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

function toPromptSummary(template: TemplateSummary): persistence.PromptSummary {
  return {
    ...template,
    category: "general",
    isShared: false,
    communityPostId: null,
    targetModel: "",
    useCase: "",
    remixedFrom: null,
    builtPrompt: "",
    enhancedPrompt: "",
    upvoteCount: 0,
    verifiedCount: 0,
    remixCount: 0,
    commentCount: 0,
  };
}

export function usePromptBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? null;
  const [config, setConfig] = useState<PromptConfig>(loadLocalDraft);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [versions, setVersions] = useState<persistence.PromptVersion[]>(loadLocalVersions);
  const [templateSummaries, setTemplateSummaries] = useState<persistence.PromptSummary[]>(() =>
    listLocalTemplateSummaries().map(toPromptSummary),
  );
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isCloudHydrated, setIsCloudHydrated] = useState(false);
  const [remixContext, setRemixContext] = useState<RemixContext | null>(null);

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

  // Load draft/prompts/versions when the auth identity changes.
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
    setRemixContext(null);

    const token = ++authLoadToken.current;

    if (!userId) {
      setIsCloudHydrated(true);
      setConfig(loadLocalDraft());
      setTemplateSummaries(listLocalTemplateSummaries().map(toPromptSummary));
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
      persistence.loadPrompts(userId),
      (async () => {
        await migrateVersionsFromGuestToCloud();
        return persistence.loadVersions(userId);
      })(),
    ]).then(([draftResult, promptsResult, versionsResult]) => {
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

      if (promptsResult.status === "fulfilled") {
        setTemplateSummaries(promptsResult.value);
      } else {
        setTemplateSummaries([]);
        showPersistenceError("Failed to load prompts", promptsResult.reason, "Failed to load prompts.");
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
        const summaries = await persistence.loadPrompts(userId);
        setTemplateSummaries(summaries);
      } catch (error) {
        showPersistenceError("Failed to refresh prompts", error, "Failed to refresh prompts.");
      }
    } else {
      setTemplateSummaries(listLocalTemplateSummaries().map(toPromptSummary));
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
    setRemixContext(null);
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
      setRemixContext(null);
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const startRemix = useCallback(
    (input: {
      postId: string;
      title: string;
      authorName?: string;
      publicConfig: PromptConfig;
      parentTags?: string[];
      parentCategory?: string;
    }) => {
      setConfig(hydrateConfig(input.publicConfig));
      setEnhancedPrompt("");
      setRemixContext({
        postId: input.postId,
        parentTitle: input.title,
        parentAuthor: input.authorName || "Community member",
        parentConfig: hydrateConfig(input.publicConfig),
        parentTags: input.parentTags ?? [],
        parentCategory: input.parentCategory ?? "general",
      });
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const clearRemix = useCallback(() => {
    setRemixContext(null);
  }, []);

  const savePrompt = useCallback(
    async (input: {
      title: string;
      description?: string;
      tags?: string[];
      category?: string;
      targetModel?: string;
      useCase?: string;
      remixNote?: string;
    }): Promise<SaveTemplateResult> => {
      const remixPayload = remixContext
        ? {
            remixedFrom: remixContext.postId,
            remixNote: input.remixNote,
            remixDiff: computeRemixDiff(remixContext.parentConfig, config, {
              parentTags: remixContext.parentTags,
              childTags: input.tags,
              parentCategory: remixContext.parentCategory,
              childCategory: input.category,
            }),
          }
        : {};
      const result = await persistence.savePrompt(userId, {
        name: input.title,
        description: input.description,
        tags: input.tags,
        category: input.category,
        targetModel: input.targetModel,
        useCase: input.useCase,
        config,
        builtPrompt: builtPrompt || "",
        enhancedPrompt: enhancedPrompt || "",
        ...remixPayload,
      });
      await refreshTemplateSummaries();
      if (remixContext) setRemixContext(null);
      return result;
    },
    [config, builtPrompt, enhancedPrompt, userId, refreshTemplateSummaries, remixContext],
  );

  const saveAndSharePrompt = useCallback(
    async (input: {
      title: string;
      description?: string;
      tags?: string[];
      category?: string;
      targetModel?: string;
      useCase: string;
      remixNote?: string;
    }): Promise<SaveTemplateResult & { postId?: string }> => {
      if (!userId) {
        throw new Error("Sign in to share prompts.");
      }

      const remixPayload = remixContext
        ? {
            remixedFrom: remixContext.postId,
            remixNote: input.remixNote,
            remixDiff: computeRemixDiff(remixContext.parentConfig, config, {
              parentTags: remixContext.parentTags,
              childTags: input.tags,
              parentCategory: remixContext.parentCategory,
              childCategory: input.category,
            }),
          }
        : {};
      const result = await persistence.savePrompt(userId, {
        name: input.title,
        description: input.description,
        tags: input.tags,
        category: input.category,
        targetModel: input.targetModel,
        useCase: input.useCase,
        config,
        builtPrompt: builtPrompt || "",
        enhancedPrompt: enhancedPrompt || "",
        ...remixPayload,
      });

      const shareResult = await persistence.sharePrompt(userId, result.record.metadata.id, {
        title: input.title,
        description: input.description,
        category: input.category,
        tags: input.tags,
        targetModel: input.targetModel,
        useCase: input.useCase,
      });
      if (!shareResult.shared) {
        throw new Error("Prompt was saved but could not be shared.");
      }

      await refreshTemplateSummaries();
      if (remixContext) setRemixContext(null);
      return { ...result, postId: shareResult.postId };
    },
    [config, builtPrompt, enhancedPrompt, userId, refreshTemplateSummaries, remixContext],
  );

  const shareSavedPrompt = useCallback(
    async (id: string, input?: persistence.PromptShareInput): Promise<persistence.ShareResult> => {
      const result = await persistence.sharePrompt(userId, id, input);
      if (result.shared) await refreshTemplateSummaries();
      return result;
    },
    [userId, refreshTemplateSummaries],
  );

  const unshareSavedPrompt = useCallback(
    async (id: string): Promise<boolean> => {
      const unshared = await persistence.unsharePrompt(userId, id);
      if (unshared) await refreshTemplateSummaries();
      return unshared;
    },
    [userId, refreshTemplateSummaries],
  );

  const saveAsTemplate = useCallback(
    async (input: {
      name: string;
      description?: string;
      tags?: string[];
    }): Promise<SaveTemplateResult> => {
      return savePrompt({
        title: input.name,
        description: input.description,
        tags: input.tags,
      });
    },
    [savePrompt],
  );

  const loadSavedTemplate = useCallback(
    async (id: string): Promise<TemplateLoadResult | null> => {
      const loaded = await persistence.loadPromptById(userId, id);
      if (!loaded) return null;
      setConfig(hydrateConfig(loaded.record.state.promptConfig));
      setEnhancedPrompt("");
      setRemixContext(null);
      markDraftDirty();
      return loaded;
    },
    [userId, markDraftDirty],
  );

  const deleteSavedTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      const deleted = await persistence.deletePrompt(userId, id);
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
    isSignedIn: Boolean(userId),
    versions,
    saveVersion,
    loadTemplate,
    savePrompt,
    saveAndSharePrompt,
    shareSavedPrompt,
    unshareSavedPrompt,
    saveAsTemplate,
    loadSavedTemplate,
    deleteSavedTemplate,
    templateSummaries,
    remixContext,
    startRemix,
    clearRemix,
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
