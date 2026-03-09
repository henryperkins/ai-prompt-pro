import { useEffect, useRef } from "react";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";
import { Textarea } from "@/components/base/textarea";
import type { BuilderSuggestionChip } from "@/lib/builder-inference";
import {
  INTENT_ROUTES,
  INTENT_ROUTE_LABELS,
  type IntentRoute,
} from "@/lib/enhance-intent";
import { ArrowCounterClockwise as RotateCcw, Sparkle as Sparkles, SpinnerGap as Loader2 } from "@phosphor-icons/react";

interface BuilderHeroInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onResetAll?: () => void;
  phase3Enabled?: boolean;
  suggestionChips?: BuilderSuggestionChip[];
  isInferringSuggestions?: boolean;
  hasInferenceError?: boolean;
  onApplySuggestion?: (chip: BuilderSuggestionChip) => void;
  onResetInferred?: () => void;
  canResetInferred?: boolean;
  detectedIntent?: IntentRoute | null;
  intentOverride?: IntentRoute | null;
  onIntentOverrideChange?: (intent: IntentRoute | null) => void;
}

export function BuilderHeroInput({
  value,
  onChange,
  onClear,
  onResetAll,
  phase3Enabled = false,
  suggestionChips = [],
  isInferringSuggestions = false,
  hasInferenceError = false,
  onApplySuggestion,
  onResetInferred,
  canResetInferred = false,
  detectedIntent,
  intentOverride,
  onIntentOverrideChange,
}: BuilderHeroInputProps) {
  const promptInputId = "builder-phase1-hero-prompt";
  const promptInputMetaId = "builder-phase1-hero-prompt-meta";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <Card className="border-border/70 bg-card/80 p-3 sm:p-4">
      <div className="space-y-3.5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={promptInputId} className="text-sm font-medium text-foreground">
              What should the model do?
            </label>
            <span
              id={promptInputMetaId}
              className={`text-sm ${
                value.length > 31000
                  ? "text-error-primary"
                  : value.length > 28000
                    ? "text-warning-primary"
                    : "text-muted-foreground"
              }`}
            >
              {value.length.toLocaleString()} / 32,000
              {value.length > 31000 && (
                <span className="ml-1 text-xs">Approaching limit</span>
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onResetAll && (
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                onClick={onResetAll}
                aria-label="Reset all builder fields"
                className="interactive-chip h-11 gap-1 px-3 text-sm sm:h-10 sm:px-2.5 sm:text-sm"
              >
                Reset all settings
              </Button>
            )}
            {value && (
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                onClick={onClear}
                aria-label="Clear prompt text"
                className="interactive-chip h-11 gap-1 px-3 text-sm sm:h-10 sm:px-2.5 sm:text-sm"
              >
                <RotateCcw className="w-3 h-3" />
                Clear prompt
              </Button>
            )}
          </div>
        </div>

        <Textarea
          ref={textareaRef}
          id={promptInputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe what the model should do..."
          className="min-h-28 max-h-[60vh] overflow-y-auto text-foreground placeholder:text-muted-foreground sm:min-h-32"
          aria-describedby={promptInputMetaId}
        />

        {onIntentOverrideChange && detectedIntent && value.trim().length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Detected:</span>
            {INTENT_ROUTES.map((route) => {
              const isActive = intentOverride
                ? route === intentOverride
                : route === detectedIntent;
              return (
                <button
                  key={route}
                  type="button"
                  onClick={() =>
                    onIntentOverrideChange(
                      route === detectedIntent && !intentOverride ? null : route,
                    )
                  }
                  className={[
                    "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent",
                  ].join(" ")}
                >
                  {INTENT_ROUTE_LABELS[route]}
                </button>
              );
            })}
            {intentOverride && (
              <button
                type="button"
                onClick={() => onIntentOverrideChange(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Use auto-detect
              </button>
            )}
          </div>
        )}

        {phase3Enabled && (isInferringSuggestions || suggestionChips.length > 0 || canResetInferred) && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Smart suggestions
              </p>
              {canResetInferred && onResetInferred && (
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  className="h-11 px-3 text-sm sm:h-10 sm:px-2.5 sm:text-sm"
                  onClick={onResetInferred}
                >
                  Reset AI details
                </Button>
              )}
            </div>
            <div className="mt-2 space-y-2">
              {isInferringSuggestions && (
                <p className="flex items-center gap-1.5 text-sm text-foreground/85">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating suggestions...
                </p>
              )}
              {suggestionChips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestionChips.map((chip) => (
                    <Button
                      key={chip.id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-auto max-w-[220px] px-2.5 py-1.5 text-left"
                      onClick={() => onApplySuggestion?.(chip)}
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{chip.label}</span>
                        {chip.description && (
                          <span className="text-xs text-muted-foreground">{chip.description}</span>
                        )}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {phase3Enabled && hasInferenceError && !isInferringSuggestions && suggestionChips.length === 0 && (
          <p className="text-sm text-muted-foreground">
            AI suggestions are temporarily unavailable.
          </p>
        )}
      </div>
    </Card>
  );
}
