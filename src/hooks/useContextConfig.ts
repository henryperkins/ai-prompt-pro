import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PromptConfig } from "@/lib/prompt-builder";
import type {
  ContextSource,
  StructuredContext,
  InterviewAnswer,
  DatabaseConnection,
  RagParameters,
} from "@/lib/context-types";

/**
 * Extracted context-config updaters from usePromptBuilder (P2-2).
 * Each callback merges a partial update into config.contextConfig and marks the draft dirty.
 */
export function useContextConfig(
  setConfig: Dispatch<SetStateAction<PromptConfig>>,
  markDraftDirty: () => void,
) {
  const updateContextSources = useCallback(
    (sources: ContextSource[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, sources },
      }));
      markDraftDirty();
    },
    [setConfig, markDraftDirty],
  );

  const updateDatabaseConnections = useCallback(
    (databaseConnections: DatabaseConnection[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, databaseConnections },
      }));
      markDraftDirty();
    },
    [setConfig, markDraftDirty],
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
    [setConfig, markDraftDirty],
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
    [setConfig, markDraftDirty],
  );

  const updateContextInterview = useCallback(
    (answers: InterviewAnswer[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, interviewAnswers: answers },
      }));
      markDraftDirty();
    },
    [setConfig, markDraftDirty],
  );

  const updateProjectNotes = useCallback(
    (notes: string) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, projectNotes: notes },
      }));
      markDraftDirty();
    },
    [setConfig, markDraftDirty],
  );

  const toggleDelimiters = useCallback(
    (value: boolean) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, useDelimiters: value },
      }));
      markDraftDirty();
    },
    [setConfig, markDraftDirty],
  );

  return {
    updateContextSources,
    updateDatabaseConnections,
    updateRagParameters,
    updateContextStructured,
    updateContextInterview,
    updateProjectNotes,
    toggleDelimiters,
  };
}
