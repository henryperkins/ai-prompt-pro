const RESTORE_PROMPT_KEY = "promptforge-restore-enhanced-prompt";

export function queueRestoredVersionPrompt(prompt: string): boolean {
  if (!prompt) return false;
  try {
    localStorage.setItem(RESTORE_PROMPT_KEY, prompt);
    return true;
  } catch {
    return false;
  }
}

export function consumeRestoredVersionPrompt(): string | null {
  try {
    const value = localStorage.getItem(RESTORE_PROMPT_KEY);
    if (value === null) return null;
    localStorage.removeItem(RESTORE_PROMPT_KEY);
    return value;
  } catch {
    return null;
  }
}
