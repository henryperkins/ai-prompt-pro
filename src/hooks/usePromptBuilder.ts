import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { PromptConfig, defaultConfig, buildPrompt, scorePrompt } from "@/lib/prompt-builder";
import {
  listTemplateSummaries as listLocalTemplateSummaries,
  type SaveTemplateResult,
  type TemplateLoadResult,
} from "@/lib/template-store";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useContextConfig } from "@/hooks/useContextConfig";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import * as persistence from "@/lib/persistence";
import {
  MAX_LOCAL_VERSIONS,
  clearCachedCloudVersions,
  clearLocalVersions,
  createVersionId,
  hydrateConfig,
  loadCachedCloudVersions,
  loadLocalDraft,
  loadLocalVersions,
  saveCachedCloudVersions,
  saveLocalVersions,
  toPromptSummary,
} from "@/lib/prompt-builder-cache";
import {
  buildRemixPayload,
  type PromptBuilderRemixContext,
} from "@/lib/prompt-builder-remix";

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
  const [isCloudHydrated, setIsCloudHydrated] = useState(false);
  const [remixContext, setRemixContext] = useState<PromptBuilderRemixContext | null>(null);

  const prevUserId = useRef<string | null>(null);
  const authLoadToken = useRef(0);

  const {
    isDraftDirty,
    markDraftDirty,
    resetDraftState,
    clearDirtyIfClean,
    editsSinceAuthChange,
  } = useDraftPersistence({ userId, config, isCloudHydrated, toast });

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

  useEffect(() => {
    if (userId) return;
    saveLocalVersions(versions);
  }, [userId, versions]);

  // Load draft/prompts/versions when the auth identity changes.
  useEffect(() => {
    const previousUserId = prevUserId.current;
    if (userId === previousUserId) return;
    prevUserId.current = userId;

    // Capture whether the user (or a preset/remix) made edits before auth
    // resolved, so we don't overwrite them with defaultConfig or a cloud draft.
    const hadPendingEdits = editsSinceAuthChange.current;

    resetDraftState();
    setEnhancedPrompt("");
    if (!hadPendingEdits) {
      setConfig(defaultConfig);
    }
    setTemplateSummaries([]);
    setVersions(userId ? loadCachedCloudVersions(userId) : loadLocalVersions());
    if (!hadPendingEdits) {
      setRemixContext(null);
    }

    const token = ++authLoadToken.current;

    if (!userId) {
      setIsCloudHydrated(true);
      if (!hadPendingEdits) {
        setConfig(loadLocalDraft());
      }
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
        if (draftResult.value && !editsSinceAuthChange.current && !hadPendingEdits) {
          setConfig(hydrateConfig(draftResult.value));
        } else if (draftResult.value && (editsSinceAuthChange.current || hadPendingEdits)) {
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
        const cloudVersions = versionsResult.value;
        if (cloudVersions.length > 0) {
          setVersions(cloudVersions);
          saveCachedCloudVersions(userId, cloudVersions);
        } else {
          setVersions([]);
          clearCachedCloudVersions(userId);
        }
      } else {
        setVersions(loadCachedCloudVersions(userId));
        showPersistenceError(
          "Failed to load version history",
          versionsResult.reason,
          "Failed to load version history.",
        );
      }

      setIsCloudHydrated(true);
      clearDirtyIfClean();
    });
  }, [userId, showPersistenceError, toast, resetDraftState, clearDirtyIfClean, editsSinceAuthChange]);

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
      resetDraftState();
      return;
    }
    markDraftDirty();
  }, [userId, markDraftDirty, resetDraftState]);

  const clearOriginalPrompt = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      originalPrompt: "",
    }));
    setEnhancedPrompt("");
    markDraftDirty();
  }, [markDraftDirty]);

  // Context-specific updaters
  const contextConfig = useContextConfig(setConfig, markDraftDirty);

  const builtPrompt = useMemo(() => buildPrompt(config), [config]);
  const score = useMemo(() => scorePrompt(config), [config]);

  const saveVersion = useCallback(
    (name?: string) => {
      const promptToSave = enhancedPrompt || builtPrompt;
      if (!promptToSave) return;
      const versionName = name || `Version ${versions.length + 1}`;

      if (userId) {
        const optimisticId = createVersionId("local");
        const optimisticVersion: persistence.PromptVersion = {
          id: optimisticId,
          name: versionName,
          prompt: promptToSave,
          timestamp: Date.now(),
        };
        const optimisticCache = [
          optimisticVersion,
          ...loadCachedCloudVersions(userId).filter((version) => version.id !== optimisticId),
        ].slice(0, MAX_LOCAL_VERSIONS);

        setVersions((prev) => [optimisticVersion, ...prev.filter((version) => version.id !== optimisticId)].slice(
          0,
          MAX_LOCAL_VERSIONS,
        ));
        saveCachedCloudVersions(userId, optimisticCache);

        const replaceOptimistic = (saved: persistence.PromptVersion) => {
          setVersions((prev) =>
            [saved, ...prev.filter((version) => version.id !== optimisticId)].slice(0, MAX_LOCAL_VERSIONS),
          );
          saveCachedCloudVersions(
            userId,
            [saved, ...loadCachedCloudVersions(userId).filter((version) => version.id !== optimisticId)].slice(
              0,
              MAX_LOCAL_VERSIONS,
            ),
          );
        };

        const rollbackOptimistic = () => {
          setVersions((prev) => prev.filter((version) => version.id !== optimisticId).slice(0, MAX_LOCAL_VERSIONS));
          saveCachedCloudVersions(
            userId,
            loadCachedCloudVersions(userId).filter((version) => version.id !== optimisticId),
          );
        };

        void persistence
          .saveVersion(userId, versionName, promptToSave)
          .then((saved) => {
            if (!saved) {
              rollbackOptimistic();
              showPersistenceError("Failed to save version", null, "Failed to save version.");
              return;
            }
            replaceOptimistic(saved);
          })
          .catch((error) => {
            rollbackOptimistic();
            showPersistenceError("Failed to save version", error, "Failed to save version.");
          });
      } else {
        const version: persistence.PromptVersion = {
          id: createVersionId("local"),
          name: versionName,
          prompt: promptToSave,
          timestamp: Date.now(),
        };
        const next = [version, ...loadLocalVersions()].slice(0, MAX_LOCAL_VERSIONS);
        saveLocalVersions(next);
        setVersions(next);
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
      const remixPayload = buildRemixPayload(remixContext, config, {
        tags: input.tags,
        category: input.category,
        remixNote: input.remixNote,
      });
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

      const remixPayload = buildRemixPayload(remixContext, config, {
        tags: input.tags,
        category: input.category,
        remixNote: input.remixNote,
      });
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
    // Context-specific (delegated to useContextConfig)
    ...contextConfig,
  };
}
