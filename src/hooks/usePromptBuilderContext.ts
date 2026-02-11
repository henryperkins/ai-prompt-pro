import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ContextSource,
  StructuredContext,
  InterviewAnswer,
  DatabaseConnection,
  RagParameters,
} from "@/lib/context-types";
import type { PromptConfig } from "@/lib/prompt-builder";

interface UsePromptBuilderContextInput {
  setConfig: Dispatch<SetStateAction<PromptConfig>>;
  markDraftDirty: () => void;
}

export function usePromptBuilderContext({ setConfig, markDraftDirty }: UsePromptBuilderContextInput) {
  const updateContextSources = useCallback(
    (sources: ContextSource[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, sources },
      }));
      markDraftDirty();
    },
    [markDraftDirty, setConfig],
  );

  const updateDatabaseConnections = useCallback(
    (databaseConnections: DatabaseConnection[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, databaseConnections },
      }));
      markDraftDirty();
    },
    [markDraftDirty, setConfig],
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
    [markDraftDirty, setConfig],
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
    [markDraftDirty, setConfig],
  );

  const updateContextInterview = useCallback(
    (answers: InterviewAnswer[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, interviewAnswers: answers },
      }));
      markDraftDirty();
    },
    [markDraftDirty, setConfig],
  );

  const updateProjectNotes = useCallback(
    (notes: string) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, projectNotes: notes },
      }));
      markDraftDirty();
    },
    [markDraftDirty, setConfig],
  );

  const toggleDelimiters = useCallback(
    (value: boolean) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, useDelimiters: value },
      }));
      markDraftDirty();
    },
    [markDraftDirty, setConfig],
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
