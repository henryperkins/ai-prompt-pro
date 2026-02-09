import { useState, useCallback, useEffect } from "react";
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
  deleteTemplateById,
  listTemplateSummaries,
  loadTemplateById,
  saveTemplateSnapshot,
  type SaveTemplateResult,
  type TemplateLoadResult,
  type TemplateSummary,
} from "@/lib/template-store";

const STORAGE_KEY = "promptforge-draft";

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

export function usePromptBuilder() {
  const [config, setConfig] = useState<PromptConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? hydrateConfig(JSON.parse(saved)) : defaultConfig;
    } catch {
      return defaultConfig;
    }
  });

  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [versions, setVersions] = useState<{ id: string; name: string; prompt: string; timestamp: number }[]>([]);
  const [templateSummaries, setTemplateSummaries] = useState<TemplateSummary[]>(() => listTemplateSummaries());

  const refreshTemplateSummaries = useCallback(() => {
    setTemplateSummaries(listTemplateSummaries());
  }, []);

  // Auto-save
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch {
        // Ignore quota errors to avoid runtime crashes.
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [config]);

  const updateConfig = useCallback((updates: Partial<PromptConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
    setEnhancedPrompt("");
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Context-specific updaters
  const updateContextSources = useCallback((sources: ContextSource[]) => {
    setConfig((prev) => ({
      ...prev,
      contextConfig: { ...prev.contextConfig, sources },
    }));
  }, []);

  const updateDatabaseConnections = useCallback((databaseConnections: DatabaseConnection[]) => {
    setConfig((prev) => ({
      ...prev,
      contextConfig: { ...prev.contextConfig, databaseConnections },
    }));
  }, []);

  const updateRagParameters = useCallback((ragUpdates: Partial<RagParameters>) => {
    setConfig((prev) => ({
      ...prev,
      contextConfig: {
        ...prev.contextConfig,
        rag: { ...prev.contextConfig.rag, ...ragUpdates },
      },
    }));
  }, []);

  const updateContextStructured = useCallback((updates: Partial<StructuredContext>) => {
    setConfig((prev) => ({
      ...prev,
      contextConfig: {
        ...prev.contextConfig,
        structured: { ...prev.contextConfig.structured, ...updates },
      },
    }));
  }, []);

  const updateContextInterview = useCallback((answers: InterviewAnswer[]) => {
    setConfig((prev) => ({
      ...prev,
      contextConfig: { ...prev.contextConfig, interviewAnswers: answers },
    }));
  }, []);

  const updateProjectNotes = useCallback((notes: string) => {
    setConfig((prev) => ({
      ...prev,
      contextConfig: { ...prev.contextConfig, projectNotes: notes },
    }));
  }, []);

  const toggleDelimiters = useCallback((value: boolean) => {
    setConfig((prev) => ({
      ...prev,
      contextConfig: { ...prev.contextConfig, useDelimiters: value },
    }));
  }, []);

  const builtPrompt = buildPrompt(config);
  const score = scorePrompt(config);

  const saveVersion = useCallback(
    (name?: string) => {
      const promptToSave = enhancedPrompt || builtPrompt;
      if (!promptToSave) return;
      const version = {
        id: Date.now().toString(),
        name: name || `Version ${versions.length + 1}`,
        prompt: promptToSave,
        timestamp: Date.now(),
      };
      setVersions((prev) => [version, ...prev]);
    },
    [enhancedPrompt, builtPrompt, versions.length]
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
    },
    []
  );

  const saveAsTemplate = useCallback(
    (input: { name: string; description?: string; tags?: string[] }): SaveTemplateResult => {
      const result = saveTemplateSnapshot({
        ...input,
        config,
      });
      refreshTemplateSummaries();
      return result;
    },
    [config, refreshTemplateSummaries]
  );

  const loadSavedTemplate = useCallback((id: string): TemplateLoadResult | null => {
    const loaded = loadTemplateById(id);
    if (!loaded) return null;
    setConfig(hydrateConfig(loaded.record.state.promptConfig));
    setEnhancedPrompt("");
    return loaded;
  }, []);

  const deleteSavedTemplate = useCallback(
    (id: string): boolean => {
      const deleted = deleteTemplateById(id);
      if (deleted) refreshTemplateSummaries();
      return deleted;
    },
    [refreshTemplateSummaries]
  );

  return {
    config,
    updateConfig,
    resetConfig,
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
