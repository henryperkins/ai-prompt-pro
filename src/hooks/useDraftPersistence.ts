import { useState, useCallback, useEffect, useRef } from "react";
import type { PromptConfig } from "@/lib/prompt-builder";
import * as persistence from "@/lib/persistence";

const DRAFT_AUTOSAVE_DELAY_MS = 700;

export interface DraftPersistenceOptions {
  userId: string | null;
  config: PromptConfig;
  isCloudHydrated: boolean;
  toast: (opts: { title: string; description: string; variant?: string }) => void;
}

/**
 * Extracted draft-persistence logic from usePromptBuilder (P2-2).
 * Manages dirty state, debounced autosave, and error deduplication.
 */
export function useDraftPersistence({
  userId,
  config,
  isCloudHydrated,
  toast,
}: DraftPersistenceOptions) {
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const draftSaveError = useRef<string | null>(null);
  const autosaveToken = useRef(0);
  const editsSinceAuthChange = useRef(false);

  const markDraftDirty = useCallback(() => {
    editsSinceAuthChange.current = true;
    setIsDraftDirty(true);
  }, []);

  const resetDraftState = useCallback(() => {
    draftSaveError.current = null;
    editsSinceAuthChange.current = false;
    setIsDraftDirty(false);
  }, []);

  const clearDirtyIfClean = useCallback(() => {
    if (!editsSinceAuthChange.current) {
      setIsDraftDirty(false);
    }
  }, []);

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

  // Debounced autosave effect
  useEffect(() => {
    if (!isDraftDirty) return;
    if (userId && !isCloudHydrated) return;

    const saveToken = ++autosaveToken.current;
    const timeout = setTimeout(() => {
      void saveDraftSafely(config, saveToken);
    }, DRAFT_AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [config, isDraftDirty, userId, isCloudHydrated, saveDraftSafely]);

  return {
    isDraftDirty,
    markDraftDirty,
    resetDraftState,
    clearDirtyIfClean,
    editsSinceAuthChange,
  };
}
