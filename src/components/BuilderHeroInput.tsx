import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
import { Textarea } from "@/components/base/textarea";
import type { BuilderSuggestionChip } from "@/lib/builder-inference";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";

interface BuilderHeroInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  phase3Enabled?: boolean;
  suggestionChips?: BuilderSuggestionChip[];
  isInferringSuggestions?: boolean;
  hasInferenceError?: boolean;
  onApplySuggestion?: (chip: BuilderSuggestionChip) => void;
  onResetInferred?: () => void;
  canResetInferred?: boolean;
}

export function BuilderHeroInput({
  value,
  onChange,
  onClear,
  phase3Enabled = false,
  suggestionChips = [],
  isInferringSuggestions = false,
  hasInferenceError = false,
  onApplySuggestion,
  onResetInferred,
  canResetInferred = false,
}: BuilderHeroInputProps) {
  const promptInputId = "builder-phase1-hero-prompt";
  const promptInputMetaId = "builder-phase1-hero-prompt-meta";

  return (
    <Card className="border-border/70 bg-card/80 p-3 sm:p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={promptInputId} className="text-sm font-medium text-foreground">
            What should the model do?
          </label>
          <div className="flex items-center gap-2">
            <span id={promptInputMetaId} className="text-xs text-muted-foreground">
              {value.length} chars
            </span>
            {value && (
              <Button
                type="button"
                color="tertiary"
                size="sm"
                onClick={onClear}
                aria-label="Clear prompt text"
                className="interactive-chip h-11 gap-1 px-3 text-sm sm:h-9 sm:px-2 sm:text-sm"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <Textarea
          id={promptInputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe the task in 1-2 sentences. Example: Draft a concise project update for executives using these notes."
          className="min-h-28 resize-y text-foreground placeholder:text-muted-foreground sm:min-h-32"
          aria-describedby={promptInputMetaId}
        />

        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Smart suggestions
            </p>
            {phase3Enabled && canResetInferred && onResetInferred && (
              <Button
                type="button"
                color="tertiary"
                size="sm"
                className="h-11 px-3 text-sm sm:h-9 sm:px-2 sm:text-sm"
                onClick={onResetInferred}
              >
                Reset AI details
              </Button>
            )}
          </div>

          {!phase3Enabled && (
            <p className="mt-1 text-xs text-muted-foreground">
              AI suggestion chips will appear here in Phase 3. For now, continue by adjusting details below.
            </p>
          )}

          {phase3Enabled && (
            <div className="mt-2 space-y-2">
              {isInferringSuggestions && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                      color="secondary"
                      size="sm"
                      className="h-11 px-2 text-sm sm:h-9 sm:text-sm"
                      onClick={() => onApplySuggestion?.(chip)}
                    >
                      {chip.label}
                    </Button>
                  ))}
                </div>
              )}

              {!isInferringSuggestions && suggestionChips.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Keep typing to get AI-generated detail suggestions.
                </p>
              )}

              {hasInferenceError && (
                <p className="text-xs text-muted-foreground">
                  AI suggestions are temporarily unavailable. Local hints are shown when possible.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
