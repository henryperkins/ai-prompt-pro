import { useState, useCallback, useEffect } from "react";
import { PromptConfig, defaultConfig, buildPrompt, scorePrompt } from "@/lib/prompt-builder";
import type { ContextSource, StructuredContext, InterviewAnswer } from "@/lib/context-types";
import { defaultContextConfig } from "@/lib/context-types";

const STORAGE_KEY = "promptforge-draft";

export function usePromptBuilder() {
  const [config, setConfig] = useState<PromptConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
    } catch {
      return defaultConfig;
    }
  });

  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [versions, setVersions] = useState<{ id: string; name: string; prompt: string; timestamp: number }[]>([]);

  // Auto-save
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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
    // Context-specific
    updateContextSources,
    updateContextStructured,
    updateContextInterview,
    updateProjectNotes,
    toggleDelimiters,
  };
}
